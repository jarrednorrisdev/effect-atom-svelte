// The keyboard shortcut that opens and closes the panel: written as a string such as "alt+shift+a"
// (the `shortcut` prop, and what the settings save), matched against the key's physical code, so a
// layout or a modifier that changes the character typed (Alt on a Mac) doesn't break it.

/** A shortcut: its modifiers and the `KeyboardEvent.code` of its key, such as `KeyA` or `F2`. */
export interface Shortcut {
  readonly alt: boolean;
  readonly ctrl: boolean;
  readonly meta: boolean;
  readonly shift: boolean;
  readonly code: string;
}

export const defaultShortcut = "alt+shift+a";

const modifierCodes = new Set([
  "AltLeft",
  "AltRight",
  "ControlLeft",
  "ControlRight",
  "MetaLeft",
  "MetaRight",
  "ShiftLeft",
  "ShiftRight",
]);

/** The code a key's name stands for: `a` is `KeyA`, `1` is `Digit1`, and anything else as it is. */
const codeOf = (key: string): string => {
  if (/^[a-z]$/iu.test(key)) {
    return `Key${key.toUpperCase()}`;
  }
  if (/^\d$/u.test(key)) {
    return `Digit${key}`;
  }
  return key.length > 1 ? key.charAt(0).toUpperCase() + key.slice(1) : key;
};

/** Reads "alt+shift+a" (or "Ctrl+Shift+F2", "meta+k"); `undefined` when there is no key. */
export const parseShortcut = (text: string): Shortcut | undefined => {
  const parts = text
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
  const key = parts.pop();
  if (key === undefined) {
    return undefined;
  }
  const mods = new Set(parts.map((part) => part.toLowerCase()));
  return {
    alt: mods.has("alt") || mods.has("option"),
    code: codeOf(key),
    ctrl: mods.has("ctrl") || mods.has("control"),
    meta: mods.has("meta") || mods.has("cmd") || mods.has("command"),
    shift: mods.has("shift"),
  };
};

/** The key's own name, as a person reads it: `KeyA` is `A`, `Digit1` is `1`. */
const keyName = (code: string): string =>
  code.replace(/^Key(?=[A-Z]$)/u, "").replace(/^Digit(?=\d$)/u, "");

/** The string form, as `parseShortcut` reads it and the settings save it: "alt+shift+a". */
export const stringifyShortcut = (shortcut: Shortcut): string =>
  [
    shortcut.ctrl && "ctrl",
    shortcut.meta && "meta",
    shortcut.alt && "alt",
    shortcut.shift && "shift",
    keyName(shortcut.code).toLowerCase(),
  ]
    .filter(Boolean)
    .join("+");

/** For display: "Alt Shift A", or "⌘ ⇧ A" on a Mac. */
export const formatShortcut = (shortcut: Shortcut, mac: boolean): string =>
  [
    shortcut.ctrl && (mac ? "⌃" : "Ctrl"),
    shortcut.meta && (mac ? "⌘" : "Meta"),
    shortcut.alt && (mac ? "⌥" : "Alt"),
    shortcut.shift && (mac ? "⇧" : "Shift"),
    keyName(shortcut.code),
  ]
    .filter(Boolean)
    .join(" ");

/** Whether a key press is the shortcut, with exactly its modifiers. */
export const matchesShortcut = (
  event: KeyboardEvent,
  shortcut: Shortcut
): boolean =>
  event.code === shortcut.code &&
  event.altKey === shortcut.alt &&
  event.ctrlKey === shortcut.ctrl &&
  event.metaKey === shortcut.meta &&
  event.shiftKey === shortcut.shift;

/**
 * The shortcut a key press makes, when recording a new one: `undefined` for a modifier on its own,
 * and for a key without Ctrl, Alt or Meta (other than a function key), which would catch typing.
 */
export const shortcutFromEvent = (
  event: KeyboardEvent
): Shortcut | undefined => {
  if (modifierCodes.has(event.code)) {
    return undefined;
  }
  const functionKey = /^F\d{1,2}$/u.test(event.code);
  if (!(event.altKey || event.ctrlKey || event.metaKey || functionKey)) {
    return undefined;
  }
  return {
    alt: event.altKey,
    code: event.code,
    ctrl: event.ctrlKey,
    meta: event.metaKey,
    shift: event.shiftKey,
  };
};
