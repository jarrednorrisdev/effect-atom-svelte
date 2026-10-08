/**
 * Watches what an atom registry does, for developer tools: every node added and removed, every
 * computation and why it ran, every value, reader, interruption and finalizer.
 *
 * Nothing is watched until `inspect` is called. In development, the registries an app provides
 * (and the default browser registry) are listed by `registries`, so a tool can find them without
 * being handed one.
 *
 * @since 0.2.0
 */
import { AsyncResult, Atom } from "effect/reactivity";
import type { AtomRegistry } from "effect/reactivity";
import { BROWSER } from "esm-env";

import { defaultIdleTTL, instrumentNode } from "./internal/nodeInternals.ts";
import { list, watch } from "./internal/registries.ts";
import {
  nameComponent as setComponentName,
  setReporter,
} from "./internal/scope.svelte.ts";
import type {
  ComponentName,
  ReadKind,
  Reporter,
} from "./internal/scope.svelte.ts";

/**
 * Why a node computed its value.
 *
 * - `FirstRead`: its first computation.
 * - `ParentChanged`: atoms it read changed since its last computation; `parents` are those nodes.
 * - `Refreshed`: `registry.refresh` (or `useAtomRefresh`) asked for it, or for an atom it wraps.
 * - `Invalidated`: something else made it stale, such as the atom refreshing itself (`refreshSelf`,
 *   a reactivity key, a window-focus signal).
 *
 * @stability unstable
 * @since 0.2.0
 * @category models
 */
export type BuildCause =
  | { readonly _tag: "FirstRead" }
  | {
      readonly _tag: "ParentChanged";
      readonly parents: readonly AtomRegistry.Node<unknown>[];
    }
  | { readonly _tag: "Refreshed" }
  | { readonly _tag: "Invalidated" };

/**
 * Where a node's new value came from.
 *
 * - `build`: its computation returned it.
 * - `write`: `registry.set`, `update` or `modify` (which the write hooks use), on it or on a
 *   writable atom that wrote it, and another atom's `get.set`, which goes through `registry.set`.
 * - `async`: anything else, such as an effect settling or a stream emitting after the computation
 *   returned.
 *
 * @stability unstable
 * @since 0.2.0
 * @category models
 */
export type UpdateSource = "build" | "write" | "async";

/**
 * Something a registry did to one of its nodes. `time` is from `performance.now()`.
 *
 * - `NodeAdded`: an atom was read, mounted or written for the first time, or again after it was
 *   removed, and the registry made a node for it.
 * - `Built`: the node is about to compute its value, for the `cause` given.
 * - `Updated`: its value changed. `first` marks its first value, which has no `previous`.
 * - `ReadersChanged`: a listener was added or removed; `readers` is how many it has now. Hooks,
 *   `registry.subscribe` and `mount`, and atoms that subscribe to others all count.
 * - `Interrupted`: its effect hadn't finished when what its computation started was torn down, so
 *   the fiber was interrupted. Followed by `Finalized`.
 * - `Finalized`: what its last computation started was torn down, before it computes again or as
 *   it is removed; `finalizers` ran.
 * - `NodeRemoved`: the registry disposed of the node, as nothing read it any more.
 *
 * @stability unstable
 * @since 0.2.0
 * @category models
 */
export type Event = {
  readonly node: AtomRegistry.Node<unknown>;
  readonly time: number;
} & (
  | { readonly _tag: "NodeAdded" }
  | { readonly _tag: "Built"; readonly cause: BuildCause }
  | {
      readonly _tag: "Updated";
      readonly first: boolean;
      readonly previous: unknown;
      readonly value: unknown;
      readonly source: UpdateSource;
    }
  | { readonly _tag: "ReadersChanged"; readonly readers: number }
  | { readonly _tag: "Interrupted" }
  | { readonly _tag: "Finalized"; readonly finalizers: number }
  | { readonly _tag: "NodeRemoved" }
);

/**
 * What `inspect` returns for a registry.
 *
 * @stability unstable
 * @since 0.2.0
 * @category models
 */
export interface Inspector {
  readonly registry: AtomRegistry.AtomRegistry;
  /**
   * Calls `listener` with each event as it happens; returns the function that stops it. Events
   * arrive in the middle of the registry's work, so a listener must not read or write atoms, nor
   * write Svelte state: queue the event and handle it later, for example on the next animation
   * frame.
   */
  readonly subscribe: (listener: (event: Event) => void) => () => void;
  /**
   * How long an atom nobody reads is kept before it is removed, in milliseconds: its own idle TTL,
   * or the registry's default. `undefined` for an atom kept alive, and for one removed as soon as
   * its last reader goes.
   */
  readonly idleTTL: (atom: Atom.Atom<unknown>) => number | undefined;
  /**
   * `false` when the registry's nodes aren't the implementation the inspector was written against
   * (a later Effect, say). Then only `NodeAdded` and `NodeRemoved` are reported.
   */
  readonly complete: boolean;
}

/** `set`, `update` and `modify`, which only pass their arguments on here. */
type Write = (atom: Atom.Atom<unknown>, argument: unknown) => unknown;

/** The parts of the registry the inspector replaces with its own. */
type Patchable = {
  set: Write;
  update: Write;
  modify: Write;
  refresh: (atom: Atom.Atom<unknown>) => void;
} & Pick<AtomRegistry.AtomRegistry, "onNodeAdded" | "onNodeRemoved">;

/** What the inspector remembers about a node between events. */
interface NodeRecord {
  builds: number;
  values: number;
  /** Parents whose value changed since this node last computed. */
  changed: Set<AtomRegistry.Node<unknown>>;
  refreshed: boolean;
  /** How many computations of this node are running: values given meanwhile are their result. */
  building: number;
}

const nodeKey = (atom: Atom.Atom<unknown>): Atom.Atom<unknown> | string =>
  Atom.isSerializable(atom) ? atom[Atom.SerializableTypeId].key : atom;

const install = (registry: AtomRegistry.AtomRegistry): Inspector => {
  const listeners = new Set<(event: Event) => void>();
  const records = new WeakMap<AtomRegistry.Node<unknown>, NodeRecord>();
  let writing = 0;
  let complete = true;

  const emit = (event: Event) => {
    for (const listener of listeners) {
      try {
        listener(event);
      } catch (error) {
        // A tool's mistake mustn't break the app's registry.
        console.error("effect-atom-svelte: an inspector listener threw", error);
      }
    }
  };

  const record = (node: AtomRegistry.Node<unknown>): NodeRecord => {
    let found = records.get(node);
    if (found === undefined) {
      found = {
        building: 0,
        builds: 0,
        changed: new Set(),
        refreshed: false,
        values: 0,
      };
      records.set(node, found);
    }
    return found;
  };

  const instrument = (node: AtomRegistry.Node<unknown>) => {
    const instrumented = instrumentNode(node, {
      build: () => {
        const self = record(node);
        let cause: BuildCause = { _tag: "Invalidated" };
        if (self.builds === 0) {
          cause = { _tag: "FirstRead" };
        } else if (self.refreshed) {
          cause = { _tag: "Refreshed" };
        } else if (self.changed.size > 0) {
          cause = { _tag: "ParentChanged", parents: [...self.changed] };
        }
        self.builds += 1;
        self.refreshed = false;
        self.changed = new Set();
        self.building += 1;
        emit({ _tag: "Built", cause, node, time: performance.now() });
      },
      built: () => {
        record(node).building -= 1;
      },
      dispose: (finalizers, value) => {
        if (finalizers === 0) {
          return;
        }
        // An effect atom's computation leaves a waiting result until its fiber is done, and a
        // finalizer that interrupts the fiber.
        if (AsyncResult.isAsyncResult(value) && value.waiting) {
          emit({ _tag: "Interrupted", node, time: performance.now() });
        }
        emit({ _tag: "Finalized", finalizers, node, time: performance.now() });
      },
      readers: () => {
        emit({
          _tag: "ReadersChanged",
          node,
          readers: node.listeners.size,
          time: performance.now(),
        });
      },
      value: (previous, value) => {
        const self = record(node);
        const first = self.values === 0;
        self.values += 1;
        if (!first) {
          for (const child of node.children) {
            record(child).changed.add(node);
          }
        }
        let source: UpdateSource = "async";
        if (self.building > 0) {
          source = "build";
        } else if (writing > 0) {
          source = "write";
        }
        emit({
          _tag: "Updated",
          first,
          node,
          previous,
          source,
          time: performance.now(),
          value,
        });
      },
    });
    complete &&= instrumented;
  };

  const patchable = registry as unknown as Patchable;
  const { modify, onNodeAdded, onNodeRemoved, refresh, set, update } =
    patchable;
  const writes = <A>(f: () => A): A => {
    writing += 1;
    try {
      return f();
    } finally {
      writing -= 1;
    }
  };
  patchable.set = (atom, value) =>
    writes(() => set.call(registry, atom, value));
  patchable.update = (atom, f) => writes(() => update.call(registry, atom, f));
  patchable.modify = (atom, f) => writes(() => modify.call(registry, atom, f));
  // An atom with its own refresh (a wrapper such as withRefresh) calls the registry's refresh for
  // the atoms it wraps, through this replacement, so each of those is marked too.
  patchable.refresh = (atom) => {
    const node = registry.getNodes().get(nodeKey(atom));
    if (node !== undefined) {
      record(node).refreshed = true;
    }
    refresh.call(registry, atom);
  };
  patchable.onNodeAdded = (node) => {
    onNodeAdded?.(node);
    instrument(node);
    emit({ _tag: "NodeAdded", node, time: performance.now() });
  };
  patchable.onNodeRemoved = (node) => {
    onNodeRemoved?.(node);
    emit({ _tag: "NodeRemoved", node, time: performance.now() });
  };
  for (const node of registry.getNodes().values()) {
    instrument(node);
    // A node that has computed before isn't on its first read or value any more.
    if (node.currentState() !== "uninitialized") {
      const self = record(node);
      self.builds = 1;
      self.values = 1;
    }
  }

  return {
    get complete() {
      return complete;
    },
    idleTTL: (atom) => {
      if (atom.keepAlive) {
        return undefined;
      }
      return atom.idleTTL ?? defaultIdleTTL(registry);
    },
    registry,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

const inspectors = new WeakMap<AtomRegistry.AtomRegistry, Inspector>();

/**
 * Starts watching a registry, and returns its inspector: the same one each time it is called for
 * the same registry.
 *
 * Until then a registry runs as it always does. From then on, in a registry made by Effect 4.0,
 * each node reports what happens to it, which costs a little on every read and write, so call it
 * from developer tools rather than from the app.
 *
 * Nodes the registry already holds are watched from now on; what happened to them before isn't
 * known. Read them with `registry.getNodes()`.
 *
 * **Example** (Logging every computation)
 *
 * ```ts
 * import { getRegistry } from "effect-atom-svelte";
 * import { inspect } from "effect-atom-svelte/inspector";
 *
 * const events = [];
 * inspect(getRegistry()).subscribe((event) => events.push(event));
 * setInterval(() => {
 *   for (const event of events.splice(0)) {
 *     if (event._tag === "Built") {
 *       console.log(event.node.atom.label?.[0], event.cause._tag);
 *     }
 *   }
 * }, 1000);
 * ```
 *
 * @stability unstable
 * @since 0.2.0
 * @category inspecting
 */
export const inspect = (registry: AtomRegistry.AtomRegistry): Inspector => {
  let inspector = inspectors.get(registry);
  if (inspector === undefined) {
    inspector = install(registry);
    inspectors.set(registry, inspector);
  }
  return inspector;
};

/**
 * The registries the app has in the browser during development: each one a `RegistryProvider` or
 * `provideRegistry` gives its children, while it is mounted, and the default browser registry once
 * something has used it. Empty on the server and in production builds.
 *
 * @stability unstable
 * @since 0.2.0
 * @category inspecting
 */
export const registries = (): readonly AtomRegistry.AtomRegistry[] => list();

/**
 * Calls `f` with `registries()` now and whenever it changes, as providers mount and unmount;
 * returns the function that stops it.
 *
 * @stability unstable
 * @since 0.2.0
 * @category inspecting
 */
export const watchRegistries = (
  f: (registries: readonly AtomRegistry.AtomRegistry[]) => void
): (() => void) => watch(f);

/**
 * How a component uses an atom it reports to a scope: `read` (`useAtomValue`, `useAtom`,
 * `useAtomResult`, `useAtomSuspense`), `mount` (`useAtomMount`), `subscribe`
 * (`useAtomSubscribe`) or `write` (`useAtomSet`, which holds the atom mounted to write it).
 *
 * @stability unstable
 * @since 0.2.0
 * @category models
 */
export type ReaderKind = ReadKind;

/**
 * A hook in the scope's part of the component tree that uses an atom. `component` and `file` name
 * the component it is in, when the atomLabels plugin of effect-atom-svelte-devtools (or
 * `nameComponent`) names components; `instance` tells two instances of one component apart.
 *
 * @stability unstable
 * @since 0.2.0
 * @category models
 */
export interface ScopeReader {
  readonly id: number;
  readonly kind: ReaderKind;
  /** The `id` of the atom's node in the snapshot. */
  readonly atom: number;
  readonly component: string | undefined;
  readonly file: string | undefined;
  readonly instance: number | undefined;
}

/**
 * An atom in a scope's snapshot.
 *
 * @stability unstable
 * @since 0.2.0
 * @category models
 */
export interface ScopeNode {
  /** Stable for the atom while the scope lives. */
  readonly id: number;
  readonly atom: Atom.Atom<unknown>;
  readonly node: AtomRegistry.Node<unknown>;
  /** The atom's label (its variable's name, with the atomLabels plugin), if it has one. */
  readonly label: string | undefined;
  /** Used by a hook in the scope, rather than only upstream of one. */
  readonly read: boolean;
  /** Has no label while other atoms in the scope do: made by a runtime, mutation or store. */
  readonly plumbing: boolean;
  /** Every listener the node has: the scope's hooks, and anything else that subscribes. */
  readonly listeners: number;
  /** The tag of its value when that is an `AsyncResult`, otherwise `Value`. */
  readonly state: "Value" | "Initial" | "Success" | "Failure";
  readonly waiting: boolean;
}

/**
 * An edge from an atom to one that reads it. With plumbing left out, an atom that reads plumbing is
 * linked to the nearest atoms upstream of it that are shown.
 *
 * @stability unstable
 * @since 0.2.0
 * @category models
 */
export interface ScopeEdge {
  readonly from: number;
  readonly to: number;
}

/**
 * What a scope's part of the component tree reads, at one moment: the atoms its hooks use, the
 * atoms upstream of them, the edges between, and the hooks.
 *
 * @stability unstable
 * @since 0.2.0
 * @category models
 */
export interface ScopeSnapshot {
  readonly nodes: readonly ScopeNode[];
  readonly edges: readonly ScopeEdge[];
  readonly readers: readonly ScopeReader[];
}

/**
 * An event a scope passes on: the inspector's `Event` for a node in the scope, with the node's
 * `id`, or `ScopeChanged` once its atoms, edges or hooks have changed, after the registry's work,
 * to take a new `snapshot()`. A node's `NodeAdded` arrives before the node is linked into the
 * scope, so it isn't passed on; the `ScopeChanged` that follows is.
 *
 * @stability unstable
 * @since 0.2.0
 * @category models
 */
export type ScopeEvent =
  | (Event & { readonly id: number })
  | { readonly _tag: "ScopeChanged" };

/**
 * A part of the component tree, as `provideInspectorScope` returns it.
 *
 * @stability unstable
 * @since 0.2.0
 * @category models
 */
export interface InspectorScope {
  /** The atoms the scope reads now. `plumbing: true` includes those otherwise left out. */
  readonly snapshot: (options?: {
    readonly plumbing?: boolean;
  }) => ScopeSnapshot;
  /**
   * Calls `listener` with each event for the scope's atoms; returns the function that stops it. The
   * first listener starts the inspector on the registries the scope reads from. As with
   * `Inspector.subscribe`, a listener must not read or write atoms or write Svelte state.
   */
  readonly subscribe: (listener: (event: ScopeEvent) => void) => () => void;
}

const emptySnapshot: ScopeSnapshot = { edges: [], nodes: [], readers: [] };

/** The scope on the server: always empty. */
const inertScope: InspectorScope = {
  snapshot: () => emptySnapshot,
  subscribe: () => () => undefined,
};

interface ScopeRead {
  readonly id: number;
  readonly registry: AtomRegistry.AtomRegistry;
  readonly atom: Atom.Atom<unknown>;
  readonly kind: ReaderKind;
  readonly component: ComponentName | undefined;
}

const stateOf = (
  node: AtomRegistry.Node<unknown>
): Pick<ScopeNode, "state" | "waiting"> => {
  // A valid node's value is read without computing anything.
  const value = node.currentState() === "valid" ? node.value() : undefined;
  return AsyncResult.isAsyncResult(value)
    ? { state: value._tag, waiting: value.waiting }
    : { state: "Value", waiting: false };
};

class Scope implements InspectorScope {
  readonly #reads = new Map<number, ScopeRead>();
  readonly #ids = new WeakMap<Atom.Atom<unknown>, number>();
  readonly #listeners = new Set<(event: ScopeEvent) => void>();
  // The inspectors the scope follows while it has listeners, by registry.
  readonly #following = new Map<AtomRegistry.AtomRegistry, () => void>();
  #nextId = 0;
  #nextRead = 0;
  // The nodes in the scope, worked out again only after something that can change them.
  #members: Set<AtomRegistry.Node<unknown>> | undefined;
  // The last nodes worked out, so a node removed from the scope still has its removal passed on.
  #previous = new Set<AtomRegistry.Node<unknown>>();
  #signature = "";
  #checking = false;

  readonly reporter: Reporter = {
    report: ({ atom, component, kind, registry }) => {
      this.#nextRead += 1;
      const id = this.#nextRead;
      this.#reads.set(id, { atom, component, id, kind, registry });
      this.#follow(registry);
      this.#changed();
      return () => {
        this.#reads.delete(id);
        this.#changed();
      };
    },
  };

  #id(atom: Atom.Atom<unknown>): number {
    let id = this.#ids.get(atom);
    if (id === undefined) {
      this.#nextId += 1;
      id = this.#nextId;
      this.#ids.set(atom, id);
    }
    return id;
  }

  /** Every node the scope's hooks use, and every node upstream of them. */
  #nodes(): Set<AtomRegistry.Node<unknown>> {
    if (this.#members !== undefined) {
      return this.#members;
    }
    const members = new Set<AtomRegistry.Node<unknown>>();
    const add = (node: AtomRegistry.Node<unknown>) => {
      if (!members.has(node)) {
        members.add(node);
        for (const parent of node.parents) {
          add(parent);
        }
      }
    };
    for (const read of this.#reads.values()) {
      const node = read.registry.getNodes().get(nodeKey(read.atom));
      if (node !== undefined) {
        add(node);
      }
    }
    this.#members = members;
    return members;
  }

  /** The nearest shown atoms upstream of `node`, looking through those not shown. */
  #shownParents(
    node: AtomRegistry.Node<unknown>,
    shown: ReadonlySet<number>
  ): Set<number> {
    const found = new Set<number>();
    const seen = new Set<AtomRegistry.Node<unknown>>();
    const walk = (parents: Iterable<AtomRegistry.Node<unknown>>) => {
      for (const parent of parents) {
        const id = this.#id(parent.atom);
        if (shown.has(id)) {
          found.add(id);
        } else if (!seen.has(parent)) {
          seen.add(parent);
          walk(parent.parents);
        }
      }
    };
    walk(node.parents);
    found.delete(this.#id(node.atom));
    return found;
  }

  snapshot(options?: { readonly plumbing?: boolean }): ScopeSnapshot {
    const members = [...this.#nodes()];
    const read = new Set(
      [...this.#reads.values()].map((entry) => this.#id(entry.atom))
    );
    const labelled = members.some((node) => node.atom.label !== undefined);
    const nodes: ScopeNode[] = members.map((node) => {
      const id = this.#id(node.atom);
      return {
        atom: node.atom,
        id,
        label: node.atom.label?.[0],
        listeners: node.listeners.size,
        node,
        plumbing: labelled && node.atom.label === undefined,
        read: read.has(id),
        ...stateOf(node),
      };
    });
    // An atom a hook uses is shown even without a label: it is what the component uses.
    const shown = nodes.filter(
      (node) => options?.plumbing === true || !node.plumbing || node.read
    );
    const shownIds = new Set(shown.map((node) => node.id));
    const edges = shown.flatMap((node) =>
      [...this.#shownParents(node.node, shownIds)].map((from) => ({
        from,
        to: node.id,
      }))
    );
    const readers = [...this.#reads.values()].map((entry) => ({
      atom: this.#id(entry.atom),
      component: entry.component?.name,
      file: entry.component?.file,
      id: entry.id,
      instance: entry.component?.instance,
      kind: entry.kind,
    }));
    return { edges, nodes: shown, readers };
  }

  subscribe(listener: (event: ScopeEvent) => void): () => void {
    this.#listeners.add(listener);
    for (const read of this.#reads.values()) {
      this.#follow(read.registry);
    }
    this.#signature = this.#sign();
    return () => {
      this.#listeners.delete(listener);
      if (this.#listeners.size === 0) {
        for (const stop of this.#following.values()) {
          stop();
        }
        this.#following.clear();
      }
    };
  }

  #follow(registry: AtomRegistry.AtomRegistry): void {
    if (this.#listeners.size === 0 || this.#following.has(registry)) {
      return;
    }
    this.#following.set(
      registry,
      inspect(registry).subscribe((event) => this.#receive(event))
    );
  }

  #receive(event: Event): void {
    const inScope =
      this.#previous.has(event.node) || this.#nodes().has(event.node);
    if (
      event._tag === "NodeAdded" ||
      event._tag === "NodeRemoved" ||
      event._tag === "Built"
    ) {
      this.#changed();
    }
    if (inScope) {
      this.#emit({ ...event, id: this.#id(event.node.atom) });
    }
  }

  #emit(event: ScopeEvent): void {
    for (const listener of this.#listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error(
          "effect-atom-svelte: an inspector scope listener threw",
          error
        );
      }
    }
  }

  /** What the snapshot shows, in short, to tell whether it changed. */
  #sign(): string {
    const { edges, nodes, readers } = this.snapshot();
    return [
      nodes.map((node) => node.id).join(","),
      edges.map((edge) => `${edge.from}>${edge.to}`).join(","),
      readers.map((reader) => `${reader.id}:${reader.atom}`).join(","),
    ].join("|");
  }

  /** The scope may have changed: work it out again once the registry's work is done. */
  #changed(): void {
    if (this.#members !== undefined) {
      this.#previous = this.#members;
    }
    this.#members = undefined;
    if (this.#checking || this.#listeners.size === 0) {
      return;
    }
    this.#checking = true;
    queueMicrotask(() => {
      this.#checking = false;
      const signature = this.#sign();
      this.#previous = this.#nodes();
      if (signature !== this.#signature) {
        this.#signature = signature;
        this.#emit({ _tag: "ScopeChanged" });
      }
    });
  }
}

/**
 * Makes the component being set up, and everything below it, an inspector scope, and returns it.
 * The library's hooks below report the atoms they use to the nearest scope, which shows those
 * atoms, everything upstream of them, and the hooks that use them. Call it while the component
 * sets up, as context requires.
 *
 * Only in the browser, in development and production alike (the effect-atom-svelte docs draw each
 * example's atoms from one); on the server it returns a scope that is always empty. Until the
 * scope has a listener it only keeps a list of its hooks: the registry's inspector starts with the
 * first listener.
 *
 * **Example** (A graph of what an example reads)
 *
 * ```ts
 * import { provideInspectorScope } from "effect-atom-svelte/inspector";
 *
 * // In the component that frames the example, around its content
 * const scope = provideInspectorScope();
 * $effect(() =>
 *   scope.subscribe((event) => {
 *     if (event._tag === "ScopeChanged") {
 *       draw(scope.snapshot());
 *     } else if (event._tag === "Updated") {
 *       pulse(event.id);
 *     }
 *   })
 * );
 * ```
 *
 * @stability unstable
 * @since 0.2.0
 * @category inspecting
 */
export const provideInspectorScope = (): InspectorScope => {
  if (!BROWSER) {
    return inertScope;
  }
  const scope = new Scope();
  setReporter(scope.reporter);
  return scope;
};

/**
 * Names the component being set up, for the scopes its hooks report to. The atomLabels plugin of
 * effect-atom-svelte-devtools calls it at the top of each component's script; without the plugin,
 * call it yourself. Only in the browser.
 *
 * @stability unstable
 * @since 0.2.0
 * @category inspecting
 */
export const nameComponent = (name: string, file?: string): void => {
  if (BROWSER) {
    setComponentName(name, file);
  }
};
