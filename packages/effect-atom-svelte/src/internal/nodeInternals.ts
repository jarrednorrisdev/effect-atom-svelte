// The one place the inspector (../Inspector.ts) relies on how Effect implements AtomRegistry rather
// than on its public API. Written against effect 4.0.1 (effect/src/reactivity/AtomRegistry.ts); the
// peer range is ~4.0.0 because of code like this.
//
// The public `AtomRegistry` announces nodes added and removed (`onNodeAdded`, `onNodeRemoved`), and
// a `Node` shows its parents, children and listeners. It says nothing when a node's value changes,
// when it computes, when what a computation started is torn down or when its listeners change.
// Each of those goes through a member of the implementation's node (`NodeImpl`), which is replaced
// on that one node:
//
// - `build()`: computes the node's value, running the atom's `read`. Wrapped, for when a
//   computation starts and ends.
// - `_value`: the node's value. Written by `setValue` (a computation's result, `setSelf`, a write)
//   and `setInitialValue`, and only when the value is not equal to the last. Made an accessor.
// - `lifetime`: what the current computation holds. `disposeLifetime` clears it, then runs its
//   `finalizers`, which interrupt the fiber of an effect atom that hasn't finished. That happens
//   before every recomputation and when the node is removed. Made an accessor.
// - `listeners`: public, but only as a set to read. Everything that reads an atom reactively
//   (`AtomRegistry.subscribe` and `mount`, an atom's `get.subscribe`, the hooks' `holdNode`) adds
//   to it and deletes from it through the node's field, so a set put in its place hears each one,
//   including the deletes of subscriptions made before.
//
// A node that lacks any of them is left alone (`instrumentNode` returns false), so a change in
// Effect stops the inspector from reporting rather than breaking the registry.
//
// docs/proposals/atom-registry-inspector.md proposes an API in Effect that would replace this file.
import type { AtomRegistry } from "effect/reactivity";

interface LifetimeImpl {
  readonly finalizers: readonly (() => void)[] | undefined;
}

interface NodeImpl {
  build: () => void;
  remove: () => void;
  preserveInitialValueOnBuild?: boolean;
  _value: unknown;
  lifetime: LifetimeImpl | undefined;
  listeners: Set<() => void>;
}

/** What `instrumentNode` reports. */
export interface NodeHooks {
  /** The node is about to compute its value. */
  readonly build: () => void;
  /** The computation `build` announced has returned or thrown. */
  readonly built: () => void;
  /** The node's value changed from `previous` to `next`. */
  readonly value: (previous: unknown, next: unknown) => void;
  /**
   * What the last computation started is about to be torn down: `finalizers` is how many will run,
   * and `value` is the node's value, still the one that computation produced.
   */
  readonly dispose: (finalizers: number, value: unknown) => void;
  /** A listener was added or removed; the node's `listeners` hold the new set. */
  readonly readers: () => void;
  /** The node's remove() has returned. */
  readonly removed: () => void;
}

const isNodeImpl = (node: object): node is NodeImpl =>
  Object.hasOwn(node, "_value") &&
  Object.hasOwn(node, "lifetime") &&
  typeof (node as Partial<NodeImpl>).build === "function" &&
  (node as Partial<NodeImpl>).listeners instanceof Set;

/** A node's listeners that report each one added or removed. */
class Listeners extends Set<() => void> {
  readonly #changed: () => void;
  constructor(listeners: Iterable<() => void>, changed: () => void) {
    super();
    for (const listener of listeners) {
      super.add(listener);
    }
    this.#changed = changed;
  }
  override add(listener: () => void): this {
    const added = !this.has(listener);
    super.add(listener);
    if (added) {
      this.#changed();
    }
    return this;
  }
  override clear(): void {
    const had = this.size > 0;
    super.clear();
    if (had) {
      this.#changed();
    }
  }
  override delete(listener: () => void): boolean {
    const deleted = super.delete(listener);
    if (deleted) {
      this.#changed();
    }
    return deleted;
  }
}

/** Reports what happens to a node, or returns false if it isn't the implementation this expects. */
export const instrumentNode = (
  node: AtomRegistry.Node<unknown>,
  hooks: NodeHooks
): boolean => {
  if (!isNodeImpl(node)) {
    return false;
  }
  const { build: compute, remove: removeNode } = node;
  node.remove = function remove() {
    try {
      removeNode.call(this);
    } finally {
      hooks.removed();
    }
  };
  let value = node._value;
  let { lifetime } = node;
  node.build = function build() {
    hooks.build();
    try {
      compute.call(this);
    } finally {
      hooks.built();
    }
  };
  Object.defineProperties(node, {
    _value: {
      configurable: true,
      enumerable: true,
      get: () => value,
      set: (next: unknown) => {
        const previous = value;
        value = next;
        hooks.value(previous, next);
      },
    },
    lifetime: {
      configurable: true,
      enumerable: true,
      get: () => lifetime,
      set: (next: LifetimeImpl | undefined) => {
        const previous = lifetime;
        lifetime = next;
        if (next === undefined && previous !== undefined) {
          hooks.dispose(previous.finalizers?.length ?? 0, value);
        }
      },
    },
  });
  node.listeners = new Listeners(node.listeners, hooks.readers);
  return true;
};

/**
 * The idle TTL a registry gives atoms without their own (`AtomRegistry.make`'s `defaultIdleTTL`),
 * which the implementation keeps but the interface doesn't show.
 */
export const defaultIdleTTL = (
  registry: AtomRegistry.AtomRegistry
): number | undefined => {
  const ttl = (registry as { readonly defaultIdleTTL?: unknown })
    .defaultIdleTTL;
  return typeof ttl === "number" ? ttl : undefined;
};

/** Whether the node holds an initial value it hasn't computed (setInitialValue on a new node). */
export const holdsInitialValue = (node: AtomRegistry.Node<unknown>): boolean =>
  (node as { preserveInitialValueOnBuild?: unknown })
    .preserveInitialValueOnBuild === true;

/** Whether the node is building and its running build has not read `parent` yet. */
export const buildWillRead = (
  node: AtomRegistry.Node<unknown>,
  parent: AtomRegistry.Node<unknown>
): boolean => {
  const reads = (node as { lifetime?: { reads?: Set<unknown> } }).lifetime
    ?.reads;
  return reads !== undefined && !reads.has(parent);
};
