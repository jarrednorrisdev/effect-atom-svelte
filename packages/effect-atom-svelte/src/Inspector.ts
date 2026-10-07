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

import { defaultIdleTTL, instrumentNode } from "./internal/nodeInternals.ts";
import { list, watch } from "./internal/registries.ts";

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
 *   writable atom that wrote it.
 * - `async`: anything else, such as an effect settling or a stream emitting after the computation
 *   returned, or another atom setting it.
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
