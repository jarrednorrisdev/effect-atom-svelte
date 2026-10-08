// When a component is destroyed, for the hooks and providers. Internal: not exported from the
// package.
import { BROWSER } from "esm-env";
import { onDestroy, onMount } from "svelte";

/**
 * Runs `f` when the component is destroyed, even while its script is still awaiting. In the browser
 * `onDestroy` only takes effect once the component mounts, so a component removed while pending
 * would never call it. A pre effect runs during init and is torn down with the component (JND-16).
 * On the server, `onDestroy` runs when the render ends.
 */
export const onTeardown = (f: () => void): void => {
  if (BROWSER) {
    $effect.pre(() => f);
  } else {
    onDestroy(f);
  }
};

/**
 * As `onTeardown`, but for a mounted component `f` runs after its children are destroyed, as with
 * `onDestroy`: a pre effect is torn down before the children, whose own teardown may still use what
 * `f` ends, such as a provider's registry. The pre effect only covers a component destroyed before
 * it mounted.
 */
export const onTeardownAfterChildren = (f: () => void): void => {
  if (!BROWSER) {
    onDestroy(f);
    return;
  }
  let mounted = false;
  $effect.pre(() => () => {
    if (!mounted) {
      f();
    }
  });
  onMount(() => {
    mounted = true;
  });
  onDestroy(f);
};
