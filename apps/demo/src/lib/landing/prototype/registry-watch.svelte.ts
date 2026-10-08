// PROTOTYPE (landing hero variants, ?variant=): throwaway, not for main.
//
// Watches the page's atom registry and lays its atoms out as a graph, for variant A's live map.
// It reads the registry implementation's internals (listeners, _value), which aren't public API.
import type { AtomRegistry } from "effect/reactivity";

interface NodeInternals {
  readonly atom: {
    readonly label?: readonly [string, string];
    readonly keepAlive: boolean;
    readonly read: unknown;
  };
  readonly parents: Set<NodeInternals>;
  readonly listeners: Set<unknown>;
  readonly _value: unknown;
}

export interface MapNode {
  readonly id: number;
  name: string;
  readers: number;
  parents: number[];
  depth: number;
  /** Bumped each time the atom's value changes, to restart its pulse. */
  pulses: number;
  /** When the registry removed it: its effect was interrupted and its finalizers ran. */
  goneAt: number | undefined;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** The map's own coordinate space; views scale it with a viewBox. */
export const width = 1000;
export const height = 640;

const goneFor = 5000;

export class RegistryWatch {
  /** A snapshot for rendering, replaced only when the graph itself changes, not as nodes move. */
  nodes = $state.raw<readonly MapNode[]>([]);
  readers = $state(0);
  updates = $state(0);
  interrupted = $state(0);
  readonly live = $derived(this.nodes.filter((node) => node.goneAt === undefined).length);

  readonly #registry: AtomRegistry.AtomRegistry;
  readonly #names: ReadonlyMap<unknown, string>;
  readonly #ids = new WeakMap<object, number>();
  readonly #values = new Map<number, unknown>();
  #next = 0;
  /** The nodes the layout moves every frame: plain objects, outside Svelte's state. */
  #all: MapNode[] = [];
  #signature = "";
  readonly #frames = new Set<(nodes: readonly MapNode[]) => void>();

  /** Calls `f` with the nodes' positions every frame; returns the unsubscribe function. */
  onFrame(f: (nodes: readonly MapNode[]) => void): () => void {
    this.#frames.add(f);
    return () => this.#frames.delete(f);
  }

  readonly #guess: (read: string) => string | undefined;

  constructor(
    registry: AtomRegistry.AtomRegistry,
    names: ReadonlyMap<unknown, string>,
    guess: (read: string) => string | undefined = () => undefined
  ) {
    this.#registry = registry;
    this.#names = names;
    this.#guess = guess;
  }

  /** Starts polling and simulating; returns the stop function. */
  start(): () => void {
    const poll = setInterval(() => this.#poll(), 150);
    const tick = () => {
      this.#step();
      frame = requestAnimationFrame(tick);
    };
    let frame = requestAnimationFrame(tick);
    this.#poll();
    return () => {
      clearInterval(poll);
      cancelAnimationFrame(frame);
    };
  }

  #id(node: NodeInternals): number {
    let id = this.#ids.get(node.atom);
    if (id === undefined) {
      id = this.#next++;
      this.#ids.set(node.atom, id);
    }
    return id;
  }

  /**
   * Plumbing the library and its runtimes create (layers, runtimes, a mutation's argument, a
   * KeyValueStore's reads and writes) is left off the map: it would bury the atoms the page wrote.
   */
  #plumbing(node: NodeInternals): boolean {
    if (this.#names.has(node.atom) || node.atom.label) {
      return false;
    }
    const read = String(node.atom.read);
    const value = node._value as { _tag?: string; value?: { _id?: string } } | undefined;
    return (
      read.includes("provideMerge") ||
      read.includes("const value = create(get)") ||
      read.includes("get.get(argAtom)") ||
      (read.includes("return initialValue") && (Array.isArray(value) || node.atom.keepAlive)) ||
      value?.value?._id === "Option"
    );
  }

  #name(node: NodeInternals): string {
    const known = this.#names.get(node.atom);
    if (known) {
      return known;
    }
    const label = node.atom.label?.[0];
    const labels: Record<string, string> = {
      "AtomRpc:listTodos:home-todos": "todosAtom",
      "AtomRpc:mutation:createTodo": "createAtom",
      "AtomRpc:mutation:toggleTodo": "toggleAtom",
    };
    if (label) {
      return labels[label] ?? label;
    }
    const guessed = this.#guess(String(node.atom.read));
    if (guessed) {
      return guessed;
    }
    if (String(node.atom.read).includes("buildWithMemoMap")) {
      return "runtime";
    }
    const [parent] = node.parents;
    if (parent?.atom.label?.[0] === "AtomRpc:listTodos:home-todos") {
      return "openCountAtom";
    }
    const value = node._value as
      | { _tag?: string; value?: { id?: number }; cause?: unknown }
      | string
      | undefined;
    if (typeof value === "string") {
      return ["bun", "pnpm", "npm"].includes(value) ? "packageManagerAtom" : "themeAtom";
    }
    if (value?._tag === "Success" && Array.isArray(value.value)) {
      return "listTodos";
    }
    if (value?._tag === "Success" && typeof value.value?.id === "number") {
      return `getTodo({ id: ${value.value.id} })`;
    }
    if (value?._tag === "Failure" && String(node.atom.read).includes("runtimeResult")) {
      return "getTodo: TodoNotFound";
    }
    return "atom";
  }

  #poll(): void {
    const now = performance.now();
    const current = ([...this.#registry.getNodes().values()] as unknown as NodeInternals[]).filter(
      (node) => !this.#plumbing(node)
    );
    const shown = new Set(current);
    const byId = new Map(this.#all.map((node) => [node.id, node]));
    const seen = new Set<number>();
    let readers = 0;

    for (const internal of current) {
      const id = this.#id(internal);
      seen.add(id);
      readers += internal.listeners.size;
      // Through hidden plumbing to the nearest atoms on the map.
      const visible = new Set<NodeInternals>();
      const walk = (parent: NodeInternals, guard: number) => {
        if (shown.has(parent)) {
          visible.add(parent);
        } else if (guard < 6) {
          for (const next of parent.parents) {
            walk(next, guard + 1);
          }
        }
      };
      for (const parent of internal.parents) {
        walk(parent, 0);
      }
      const parents = [...visible].map((parent) => this.#id(parent));
      let node = byId.get(id);
      if (!node || node.goneAt !== undefined) {
        // New (or back again): start beside a parent if it has one, so it grows out of it.
        const parent = parents.map((p) => byId.get(p)).find(Boolean);
        node = {
          depth: 0,
          goneAt: undefined,
          id,
          name: this.#name(internal),
          parents,
          pulses: 0,
          readers: 0,
          vx: 0,
          vy: 0,
          x: parent ? parent.x + 60 : width * (0.2 + Math.random() * 0.6),
          y: parent ? parent.y + (Math.random() - 0.5) * 60 : height * (0.2 + Math.random() * 0.6),
        };
        byId.set(id, node);
      }
      node.readers = internal.listeners.size;
      node.name = this.#name(internal);
      node.parents = parents;
      const previous = this.#values.get(id);
      if (this.#values.has(id) && previous !== internal._value) {
        node.pulses += 1;
        this.updates += 1;
      }
      this.#values.set(id, internal._value);
    }

    for (const node of byId.values()) {
      if (!seen.has(node.id) && node.goneAt === undefined) {
        node.goneAt = now;
        node.readers = 0;
        this.#values.delete(node.id);
        this.interrupted += 1;
      }
    }

    const nodes = [...byId.values()].filter(
      (node) => node.goneAt === undefined || now - node.goneAt < goneFor
    );
    // A runtime is named after what it serves.
    for (const runtime of nodes.filter((node) => node.name.endsWith("runtime"))) {
      const served = nodes.filter((node) => node.parents.includes(runtime.id)).map((n) => n.name);
      runtime.name = served.some((name) => /todo|Todo|create|toggle/.test(name))
        ? "TodosRpc runtime"
        : served.some((name) => /packageManager|theme/.test(name))
          ? "KeyValueStore runtime"
          : "runtime";
    }
    // What can't be named is plumbing this didn't recognize: leave it off too.
    const named = nodes.filter((node) => node.name !== "atom" && node.name !== "runtime");
    // Depth: the longest chain of parents, so sources sit left and what derives from them right.
    const lookup = new Map(named.map((node) => [node.id, node]));
    const depth = (node: MapNode, guard = 0): number =>
      guard > 8 || node.parents.length === 0
        ? 0
        : 1 + Math.max(...node.parents.map((p) => (lookup.has(p) ? depth(lookup.get(p)!, guard + 1) : 0)));
    for (const node of named) {
      node.depth = depth(node);
    }
    this.#all = named;
    const signature = named
      .map((n) => `${n.id}:${n.name}:${n.readers}:${n.parents}:${n.pulses}:${n.goneAt ?? ""}`)
      .join("|");
    if (signature !== this.#signature) {
      this.#signature = signature;
      this.nodes = named.map((node) => ({ ...node }));
    }
    this.readers = readers;
  }

  /** One step of a small force layout: nodes repel, edges pull, depth sets the column. */
  #step(): void {
    const nodes = this.#all;
    const lookup = new Map(nodes.map((node) => [node.id, node]));
    for (const a of nodes) {
      for (const b of nodes) {
        if (a === b) {
          continue;
        }
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = Math.max(dx * dx + dy * dy, 100);
        const force = 3600 / d2;
        a.vx += (dx / Math.sqrt(d2)) * force;
        a.vy += (dy / Math.sqrt(d2)) * force;
      }
      for (const parentId of a.parents) {
        const parent = lookup.get(parentId);
        if (parent) {
          a.vy += (parent.y - a.y) * 0.004;
          parent.vy += (a.y - parent.y) * 0.002;
        }
      }
      const column = width * 0.06 + a.depth * 300;
      a.vx += (column - a.x) * 0.01;
      a.vy += (height / 2 - a.y) * 0.0015;
    }
    for (const node of nodes) {
      node.vx *= 0.8;
      node.vy *= 0.8;
      node.x = Math.min(width - 220, Math.max(40, node.x + node.vx));
      node.y = Math.min(height - 30, Math.max(30, node.y + node.vy));
    }
    for (const f of this.#frames) {
      f(nodes);
    }
  }
}
