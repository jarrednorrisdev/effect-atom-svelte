import { describe, expect, test } from "vitest";

import {
  formatShortcut,
  matchesShortcut,
  parseShortcut,
  shortcutFromEvent,
  stringifyShortcut,
} from "../src/internal/shortcut.ts";

const press = (init: Partial<KeyboardEvent>) => init as KeyboardEvent;

describe("shortcut", () => {
  test("reads a shortcut and writes it back", () => {
    const shortcut = parseShortcut("Alt+Shift+A");
    expect(shortcut).toEqual({
      alt: true,
      code: "KeyA",
      ctrl: false,
      meta: false,
      shift: true,
    });
    expect(stringifyShortcut(shortcut ?? ({} as never))).toBe("alt+shift+a");
    expect(stringifyShortcut(parseShortcut("ctrl+F2") ?? ({} as never))).toBe(
      "ctrl+f2"
    );
    expect(parseShortcut("")).toBeUndefined();
  });

  test("formats for each platform", () => {
    const shortcut = parseShortcut("meta+shift+1");
    expect(shortcut && formatShortcut(shortcut, true)).toBe("⌘ ⇧ 1");
    expect(shortcut && formatShortcut(shortcut, false)).toBe("Meta Shift 1");
  });

  test("matches a key press by its code, with exactly its modifiers", () => {
    const shortcut = parseShortcut("alt+shift+a");
    const base = { altKey: true, code: "KeyA", ctrlKey: false, metaKey: false };
    expect(
      shortcut && matchesShortcut(press({ ...base, shiftKey: true }), shortcut)
    ).toBe(true);
    expect(
      shortcut && matchesShortcut(press({ ...base, shiftKey: false }), shortcut)
    ).toBe(false);
  });

  test("records only presses that can't be typing", () => {
    const plain = {
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
    };
    expect(
      shortcutFromEvent(press({ ...plain, code: "KeyA" }))
    ).toBeUndefined();
    expect(
      shortcutFromEvent(press({ ...plain, code: "ShiftLeft", shiftKey: true }))
    ).toBeUndefined();
    expect(shortcutFromEvent(press({ ...plain, code: "F2" }))?.code).toBe("F2");
    expect(
      shortcutFromEvent(press({ ...plain, code: "KeyD", ctrlKey: true }))?.ctrl
    ).toBe(true);
  });

  test("matches and names a recorded key whose code has several words once saved", () => {
    const arrowUp = press({
      altKey: true,
      code: "ArrowUp",
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
    });
    // The settings save the string, and the panel reads it back on every key press.
    const saved = stringifyShortcut(
      shortcutFromEvent(arrowUp) ?? ({} as never)
    );
    const shortcut = parseShortcut(saved);
    expect(shortcut && matchesShortcut(arrowUp, shortcut)).toBe(true);
    expect(shortcut && formatShortcut(shortcut, false)).toBe("Alt ArrowUp");
  });
});
