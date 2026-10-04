/**
 * Whether the live examples may play sounds. The choice lives in localStorage under `sound`; with
 * no stored choice, sound is on, as on effect.kitlangton.com. Browsers only allow audio after the
 * visitor has interacted with the page, and the examples only play sounds in answer to a click, so
 * nothing ever plays on page load.
 *
 * This module is tiny on purpose: the header toggle imports it on every page. The synthesizer
 * (`kit/sound.ts`) loads only with pages that have examples.
 */

const storageKey = "sound";

// Used when storage is unavailable (private windows), so the toggle still works for this page.
let fallback = true;

/** Whether sound is on. Read on every cue, so a change applies at once to every example. */
export const isSoundOn = (): boolean => {
  try {
    const value = localStorage.getItem(storageKey);
    return value === null ? fallback : value === "on";
  } catch {
    return fallback;
  }
};

/** Turns sound on or off and remembers the choice. */
export const setSoundOn = (on: boolean) => {
  fallback = on;
  try {
    localStorage.setItem(storageKey, on ? "on" : "off");
  } catch {
    // Storage can be unavailable; the fallback keeps the choice for this page.
  }
};
