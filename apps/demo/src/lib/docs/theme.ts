/**
 * Light and dark mode. The choice lives in localStorage, and an inline script in `app.html` applies
 * it before first paint, so prerendered pages (which never see a request's cookies) don't flash.
 * With no stored choice the page follows `prefers-color-scheme`. Keep that script in step with
 * this module.
 */

export type Theme = "light" | "dark";

const storageKey = "theme";
const darkQuery = "(prefers-color-scheme: dark)";

const stored = (): Theme | undefined => {
  try {
    const value = localStorage.getItem(storageKey);
    return value === "light" || value === "dark" ? value : undefined;
  } catch {
    return undefined;
  }
};

const isDark = () => document.documentElement.classList.contains("dark");

/**
 * Switches the class on `<html>` with transitions off, so colors change at once instead of
 * animating on every element that has a transition.
 */
const apply = (theme: Theme) => {
  const style = document.createElement("style");
  style.textContent = "*,*::before,*::after{transition:none!important}";
  document.head.append(style);
  document.documentElement.classList.toggle("dark", theme === "dark");
  // Force a style recalculation before transitions come back.
  window.getComputedStyle(document.body).getPropertyValue("opacity");
  style.remove();
};

/** Flips the theme and remembers the choice. */
export const toggleTheme = () => {
  const next: Theme = isDark() ? "light" : "dark";
  try {
    localStorage.setItem(storageKey, next);
  } catch {
    // Storage can be unavailable (private windows); the switch still applies to this page.
  }
  apply(next);
};

/** Follows the system setting while the visitor has made no choice. Returns a cleanup. */
export const followSystemTheme = () => {
  const query = window.matchMedia(darkQuery);
  const onChange = () => {
    if (stored() === undefined) {
      apply(query.matches ? "dark" : "light");
    }
  };
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
