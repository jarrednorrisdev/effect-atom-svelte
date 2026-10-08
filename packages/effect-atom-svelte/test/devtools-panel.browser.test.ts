// The devtools panel (effect-atom-svelte-devtools), whose package has no browser tests of its own, so
// the panel is tested here, in a real browser.
import { tick } from "svelte";
import type { Component } from "svelte";
import { describe, expect, test } from "vitest";
import { render } from "vitest-browser-svelte";

import { sleep } from "./helpers.ts";

// Through a glob, so this package's type check doesn't take in the devtools' source.
const [load] = Object.values(
  (
    import.meta as ImportMeta & {
      glob: <M>(pattern: string) => Record<string, () => Promise<M>>;
    }
  ).glob<{ default: Component<{ shortcut?: string }> }>(
    "../../effect-atom-svelte-devtools/src/atom-devtools.svelte"
  )
);
const loaded = await load?.();
if (!loaded) {
  throw new Error("The devtools panel's source wasn't found");
}
const AtomDevtools = loaded.default;

const press = (init: KeyboardEventInit) => {
  window.dispatchEvent(
    new KeyboardEvent("keydown", { bubbles: true, ...init })
  );
};
const docked = () =>
  document.querySelector('section[aria-label="Atom devtools"]') !== null;

describe("AtomDevtools", () => {
  test("follows a shortcut prop the app sets after the panel has saved its settings", async () => {
    localStorage.clear();
    // The first visit, with the default shortcut: the panel saves its state, shortcut included.
    const first = await render(AtomDevtools, {});
    await sleep(50);
    await first.unmount();

    // The app then sets its own shortcut; nobody changed it in the settings.
    await render(AtomDevtools, { shortcut: "ctrl+shift+f2" });
    await sleep(50);
    press({ code: "F2", ctrlKey: true, key: "F2", shiftKey: true });
    await tick();
    expect(docked()).toBe(true);
    localStorage.clear();
  });

  test("follows a shortcut prop over the default that earlier versions saved", async () => {
    localStorage.setItem(
      "effect-atom-svelte-devtools",
      JSON.stringify({ shortcut: "alt+shift+a" })
    );
    await render(AtomDevtools, { shortcut: "ctrl+shift+f2" });
    await sleep(50);
    press({ code: "F2", ctrlKey: true, key: "F2", shiftKey: true });
    await tick();
    expect(docked()).toBe(true);
    localStorage.clear();
  });
});
