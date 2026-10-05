/**
 * The search shortcut as the reader's platform writes it, for the header's search button and the
 * error page. The server can't know the platform, so it renders Ctrl K and Macs switch to ⌘K after
 * hydration. Call it while a component initializes.
 */
export const searchShortcut = () => {
  let shortcut = $state("Ctrl K");
  $effect(() => {
    if (/Mac|iPhone|iPad/u.test(navigator.userAgent)) {
      shortcut = "⌘K";
    }
  });
  return {
    get current() {
      return shortcut;
    },
  };
};
