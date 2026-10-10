// The values live HydrationBoundary components have queued, per registry. Internal: not exported
// from the package.
import type { AtomRegistry } from "effect/reactivity";

/**
 * Per registry, key and queued value, how many live boundaries queued it. Boundaries given the
 * same state, as a layout and its page might be, queue the same values, and one destroyed first
 * must leave them for the other's children.
 */
export const queuedBy = new WeakMap<
  AtomRegistry.AtomRegistry,
  Map<string, Map<unknown, number>>
>();

/** Whether a live boundary brought a value for the key: it sends that value to the browser itself. */
export const queuedByBoundary = (
  registry: AtomRegistry.AtomRegistry,
  key: string
): boolean => queuedBy.get(registry)?.has(key) === true;
