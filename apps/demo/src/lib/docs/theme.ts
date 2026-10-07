/**
 * Dark, light, or whatever the system prefers. The choice is an `Atom.kvs` atom kept in
 * localStorage under `theme`, dark until the visitor picks another. An inline script in `app.html`
 * applies the stored choice before first paint, so prerendered pages (which never see the
 * visitor's storage) don't flash. Keep that script in step with this module.
 */

import { browser } from "$app/env";
import { Schema } from "effect";
import { KeyValueStore } from "effect/persistence";
import { Atom } from "effect/reactivity";

export const themeChoices = ["dark", "light", "system"] as const;
export type ThemeChoice = (typeof themeChoices)[number];
export type Theme = "dark" | "light";

// localStorage only exists in the browser; the server renders the default.
const storage = Atom.runtime(
  browser
    ? KeyValueStore.layerStorage(() => localStorage)
    : KeyValueStore.layerMemory
);

/** The visitor's choice, stored as JSON: `"dark"`, `"light"` or `"system"`. */
export const themeChoiceAtom = Atom.kvs({
  defaultValue: (): ThemeChoice => "dark",
  key: "theme",
  runtime: storage,
  schema: Schema.Literals(themeChoices),
});

/** Whether the system prefers dark, following changes while something reads it. */
const systemDarkAtom = Atom.make((get) => {
  if (!browser) {
    return true;
  }
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => get.setSelf(query.matches);
  query.addEventListener("change", onChange);
  get.addFinalizer(() => query.removeEventListener("change", onChange));
  return query.matches;
});

/** The theme the page shows: the choice, with "system" resolved. */
export const themeAtom = Atom.make((get): Theme => {
  const choice = get(themeChoiceAtom);
  if (choice !== "system") {
    return choice;
  }
  return get(systemDarkAtom) ? "dark" : "light";
});

/**
 * Marks `<html>` with the choice (for the header's icon) and the theme. A change of theme switches
 * with transitions off, so colors change at once instead of animating on every element that has a
 * transition.
 */
export const applyTheme = (choice: ThemeChoice, theme: Theme) => {
  const root = document.documentElement;
  root.dataset.theme = choice;
  if (root.classList.contains("dark") === (theme === "dark")) {
    return;
  }
  const style = document.createElement("style");
  style.textContent = "*,*::before,*::after{transition:none!important}";
  document.head.append(style);
  root.classList.toggle("dark", theme === "dark");
  // Force a style recalculation before transitions come back.
  window.getComputedStyle(document.body).getPropertyValue("opacity");
  style.remove();
};
