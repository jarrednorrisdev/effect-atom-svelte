// When a server render ends, for the hooks that release what they hold in a registry the caller may
// keep across requests. Internal: not exported from the package.
import { getAbortSignal, onDestroy } from "svelte";

/**
 * Runs `f` once when the server render ends: in `onDestroy`, and failing that when the render's
 * abort signal fires. A `<svelte:boundary>` with a `failed` snippet discards the content of children
 * that throw while setting up, and their `onDestroy` callbacks with it, so a component set up before
 * the throw would otherwise keep its mounts and holds on a caller-owned registry, and the next
 * request would render this one's initial values (JND-17). On the server `getAbortSignal` returns the
 * render's signal, which Svelte aborts once every `onDestroy` has run. Call it during component init.
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
  getAbortSignal().addEventListener("abort", once, { once: true });
};
