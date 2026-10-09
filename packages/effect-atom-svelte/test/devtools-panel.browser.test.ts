// The devtools panel (effect-atom-svelte-devtools), whose package has no browser tests of its own, so
// the panel is tested here, in a real browser.
import { Atom, AtomRegistry } from "effect/reactivity";
import { tick } from "svelte";
import type { Component, Snippet } from "svelte";
import { describe, expect, test } from "vitest";
import { render } from "vitest-browser-svelte";

import TwoRegistries from "./fixtures/devtools-two-registries.svelte";
import { sleep } from "./helpers.ts";

// Through a glob, so this package's type check doesn't take in the devtools' source.
const [load] = Object.values(
  (
    import.meta as ImportMeta & {
      glob: <M>(pattern: string) => Record<string, () => Promise<M>>;
    }
  ).glob<{
    default: Component<{
      shortcut?: string;
      open?: boolean;
      registry?: AtomRegistry.AtomRegistry;
    }>;
  }>("../../effect-atom-svelte-devtools/src/atom-devtools.svelte")
);
const loaded = await load?.();
if (!loaded) {
  throw new Error("The devtools panel's source wasn't found");
}
const AtomDevtools = loaded.default;

// The built package, which the panel's own imports resolve to: one list of registries for both.
const [loadBuilt] = Object.values(
  (
    import.meta as ImportMeta & {
      glob: <M>(pattern: string) => Record<string, () => Promise<M>>;
    }
  ).glob<{
    RegistryProvider: Component<{
      registry: AtomRegistry.AtomRegistry;
      children: Snippet;
    }>;
  }>("../dist/index.js")
);
const built = await loadBuilt?.();
if (!built) {
  throw new Error("The built package wasn't found: build it first");
}

const press = (init: KeyboardEventInit) => {
  window.dispatchEvent(
    new KeyboardEvent("keydown", { bubbles: true, ...init })
  );
};
const docked = () =>
  document.querySelector('section[aria-label="Atom devtools"]') !== null;
// A button in the panel, by its text or the end of it.
const panelButton = (text: string) =>
  [
    ...document.querySelectorAll<HTMLButtonElement>(
      "[data-atom-devtools] button"
    ),
  ].find(
    (item) =>
      item.textContent?.trim() === text ||
      item.textContent?.trim().endsWith(text)
  );
// A node in the panel's graph, by its atom's name.
const graphNode = (name: string) =>
  [
    ...document.querySelectorAll<HTMLElement>(
      "[data-atom-devtools] [data-node]"
    ),
  ].find(
    (item) =>
      item.querySelector(".label")?.firstChild?.textContent?.trim() === name
  );

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

  test("keeps the default shortcut a user chose in the settings over the app's", async () => {
    localStorage.clear();
    const first = await render(AtomDevtools, {
      open: true,
      shortcut: "ctrl+shift+f2",
    });
    await sleep(50);
    const settingsTab = [...document.querySelectorAll("button")].find(
      (button) => button.textContent?.trim().endsWith("Settings")
    );
    settingsTab?.click();
    await tick();
    const change = [...document.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Change"
    );
    expect(change).toBeDefined();
    change?.click();
    await tick();
    // The user records the library's default, Alt+Shift+A.
    press({ altKey: true, code: "KeyA", key: "A", shiftKey: true });
    await sleep(50);
    expect(
      JSON.parse(localStorage.getItem("effect-atom-svelte-devtools") ?? "{}")
        .shortcut
    ).toBe("alt+shift+a");
    await first.unmount();

    await render(AtomDevtools, { open: false, shortcut: "ctrl+shift+f2" });
    await sleep(50);
    press({ altKey: true, code: "KeyA", key: "A", shiftKey: true });
    await tick();
    expect(docked()).toBe(true);
    localStorage.clear();
  });

  test("drops the timeline's atom filter when it switches to another registry", async () => {
    localStorage.clear();
    const other = AtomRegistry.make();
    const beta = Atom.make(0).pipe(Atom.withLabel("betaAtom"), Atom.keepAlive);
    other.get(beta);
    const mine = AtomRegistry.make();
    const alpha = Atom.make(0).pipe(
      Atom.withLabel("alphaAtom"),
      Atom.keepAlive
    );
    const screen = await render(TwoRegistries, {
      Panel: AtomDevtools,
      Provider: built.RegistryProvider,
      mine,
      other,
    });
    mine.get(alpha);
    mine.set(alpha, 1);
    await sleep(50);
    panelButton("Timeline")?.click();
    await sleep(50);
    // Only alphaAtom's rows.
    panelButton("alphaAtom")?.click();
    await sleep(50);
    expect(panelButton("only alphaAtom ✕")).toBeDefined();
    const picker = document.querySelector<HTMLSelectElement>(
      "[data-atom-devtools] select"
    );
    expect(picker).not.toBeNull();
    if (picker) {
      // The provider's registry, tracked last.
      picker.value = String(picker.options.length - 1);
      picker.dispatchEvent(new Event("change", { bubbles: true }));
    }
    await sleep(100);
    // Now on the provider's registry.
    expect(
      document.querySelector<HTMLSelectElement>("[data-atom-devtools] select")
        ?.selectedIndex
    ).toBe((picker?.options.length ?? 0) - 1);
    // The other registry has no alphaAtom: the filter mustn't now pick one of its atoms.
    const filter = [...document.querySelectorAll("[data-atom-devtools] button")]
      .map((item) => item.textContent?.trim() ?? "")
      .find((label) => label.startsWith("only "));
    expect(filter).toBeUndefined();
    await screen.unmount();
    localStorage.clear();
  });

  test("keeps the selected atom marked in the graph as the graph changes", async () => {
    localStorage.clear();
    const registry = AtomRegistry.make();
    const count = Atom.make(1).pipe(Atom.withLabel("countAtom"));
    const double = Atom.make((get) => get(count) * 2).pipe(
      Atom.withLabel("doubleAtom")
    );
    const release = registry.mount(double);
    const screen = await render(AtomDevtools, { open: true, registry });
    await sleep(50);
    panelButton("Graph")?.click();
    await sleep(50);
    graphNode("doubleAtom")?.click();
    await sleep(50);
    panelButton("Graph")?.click();
    await sleep(50);
    expect(graphNode("doubleAtom")?.classList.contains("selected")).toBe(true);
    // Something starts reading doubleAtom: the graph grows a column after it.
    const quad = Atom.make((get) => get(double) * 2).pipe(
      Atom.withLabel("quadAtom")
    );
    const releaseQuad = registry.mount(quad);
    await sleep(100);
    expect(graphNode("doubleAtom")?.classList.contains("selected")).toBe(true);
    releaseQuad();
    release();
    await screen.unmount();
    localStorage.clear();
  });
});
