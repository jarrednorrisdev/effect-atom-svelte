/**
 * The text font: Inter by default, or Libron. The choice lives in localStorage under `font`, and
 * `<html data-font="libron">` follows it, which app.css switches the font from. app.html's inline
 * script sets the attribute before first paint from the same storage key, so prerendered pages
 * don't flash the wrong font; keep the two in step.
 */

export type Font = "inter" | "libron";

const storageKey = "font";

/** The font the page shows now. */
export const currentFont = (): Font =>
  document.documentElement.dataset.font === "libron" ? "libron" : "inter";

/** Switches the font and remembers the choice. */
export const setFont = (font: Font) => {
  if (font === "libron") {
    document.documentElement.dataset.font = "libron";
  } else {
    delete document.documentElement.dataset.font;
  }
  try {
    localStorage.setItem(storageKey, font);
  } catch {
    // Storage can be unavailable (private windows); the switch still applies to this page.
  }
};
