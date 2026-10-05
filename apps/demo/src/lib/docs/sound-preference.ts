/**
 * Whether the live examples may play sounds. The choice lives in localStorage under `sound`; with
 * no stored choice, sound is off, so a reader hears nothing they didn't ask for. Even when it is
 * on, browsers only allow audio after the visitor has interacted with the page, and the examples
 * only play sounds in answer to a click, so nothing ever plays on page load.
 *
 * This module is tiny on purpose: the header toggle imports it on every page, as it does
 * `kit/sound.ts`, which is small too. Tone.js (`kit/sound-engine.ts`) loads only when a cue first
 * plays, and never while sound is off.
 */

const storageKey = "sound";

// Used when storage is unavailable (private windows), so the toggle still works for this page.
let fallback = false;

/** Whether sound is on. Read on every cue, so a change applies at once to every example. */
export const isSoundOn = (): boolean => {
  try {
    const value = localStorage.getItem(storageKey);
    return value === null ? fallback : value === "on";
  } catch {
    return fallback;
  }
};

/**
 * Turns sound on or off and remembers the choice. `<html data-sound>` follows it, which the
 * header's icon is styled from; app.html's inline script sets it before first paint from the same
 * storage key, so keep the two in step.
 */
export const setSoundOn = (on: boolean) => {
  fallback = on;
  document.documentElement.dataset.sound = on ? "on" : "off";
  try {
    localStorage.setItem(storageKey, on ? "on" : "off");
  } catch {
    // Storage can be unavailable; the fallback keeps the choice for this page.
  }
};
