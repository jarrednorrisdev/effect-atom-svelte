// What to do when a registry a provider owns is disposed of. Internal: not exported from the
// package. The registry itself tells nobody: its nodes drop their listeners without a last
// notification, so a promise-mode setter waiting on one would never settle.
import type { AtomRegistry } from "effect/reactivity";
import { BROWSER } from "esm-env";

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
 *
 * In the browser that error is rethrown on a microtask, so it is still reported as uncaught but
 * stays out of Svelte's teardown: thrown from the `onDestroy` of a component being destroyed, it
 * escapes Svelte's flush and leaves every `$derived` on the page running again on every read. On
 * the server it is thrown here.
 */
export const disposeRegistry = (registry: AtomRegistry.AtomRegistry): void => {
  try {
    registry.dispose();
  } catch (error) {
    if (!BROWSER) {
      throw error;
    }
    queueMicrotask(() => {
      throw error;
    });
  } finally {
    const set = callbacks.get(registry);
    callbacks.delete(registry);
    for (const f of set ?? []) {
      f();
    }
  }
};
