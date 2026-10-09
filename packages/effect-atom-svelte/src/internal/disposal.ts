// What to do when a registry a provider owns is disposed of. Internal: not exported from the
// package. The registry itself tells nobody: its nodes drop their listeners without a last
// notification, so a promise-mode setter waiting on one would never settle.
import type { AtomRegistry } from "effect/reactivity";

const callbacks = new WeakMap<AtomRegistry.AtomRegistry, Set<() => void>>();

/** Calls `f` once if `registry` is disposed of through `disposeRegistry`; returns the canceler. */
export const onDispose = (
  registry: AtomRegistry.AtomRegistry,
  f: () => void
): (() => void) => {
  let set = callbacks.get(registry);
  if (set === undefined) {
    set = new Set();
    callbacks.set(registry, set);
  }
  set.add(f);
  return () => {
    set.delete(f);
  };
};

/**
 * Disposes of `registry`, then runs what waited on it, even when a finalizer the disposal runs
 * throws.
 */
export const disposeRegistry = (registry: AtomRegistry.AtomRegistry): void => {
  try {
    registry.dispose();
  } finally {
    const set = callbacks.get(registry);
    callbacks.delete(registry);
    for (const f of set ?? []) {
      f();
    }
  }
};
