// When a server render ends, for the hooks that release what they hold in a registry the caller may
// keep across requests. Internal: not exported from the package.
import { getAbortSignal, onDestroy } from "svelte";

/**
 * Runs `f` once when the server render ends: in `onDestroy`, and failing that when the render's
 * abort signal fires. A `<svelte:boundary>` with a `failed` snippet discards the content of children
 * that throw while setting up, and their `onDestroy` callbacks with it, so a component set up before
 * the throw would otherwise keep its mounts and holds on a caller-owned registry, and the next
 * request would render this one's initial values (JND-17). On the server `getAbortSignal` returns the
 * render's signal, which Svelte aborts once every `onDestroy` has run. A dropped component whose
 * script awaits before calling this resumes after the render has ended and the signal has aborted,
 * where a listener would never fire, so `f` then runs in a microtask: callers take what `f` releases
 * synchronously after calling this. Call it during component init. Svelte bug workaround, to be
 * removed with the fix (https://github.com/jarrednorrisdev/effect-atom-svelte/issues/35).
 */
export const onRenderEnd = (f: () => void): void => {
  let done = false;
  const once = () => {
    if (!done) {
      done = true;
      f();
    }
  };
  onDestroy(once);
  const signal = getAbortSignal();
  if (signal.aborted) {
    // The render already ended, as for a component a failed boundary dropped whose script resumed
    // after an await. Deferred, as callers register before taking what `f` releases.
    queueMicrotask(once);
  } else {
    signal.addEventListener("abort", once, { once: true });
  }
};
