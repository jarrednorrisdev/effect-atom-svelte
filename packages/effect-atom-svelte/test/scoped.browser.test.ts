import { hydrate, unmount } from "svelte";
import type { Component } from "svelte";
import { beforeAll, describe, expect, onTestFinished, test, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { commands } from "vitest/browser";

import ScopedRemountFade from "./fixtures/scoped-remount-fade.svelte";
import { familyComputed, scopedComputed } from "./fixtures/scoped-seed.ts";
import SsrFamilyThread from "./fixtures/ssr-family-thread.svelte";
import SsrScopedFamily from "./fixtures/ssr-scoped-family.svelte";
import SsrScopedRemount from "./fixtures/ssr-scoped-remount.svelte";
import { sleep } from "./helpers.ts";

interface ServerOutput {
  readonly body: string;
  readonly head: string;
}

declare module "vitest/browser" {
  interface BrowserCommands {
    renderOnServer: (path: string) => Promise<ServerOutput>;
  }
}

const outputs = (target: HTMLElement) => () =>
  [...target.querySelectorAll("output")].map((output) => output.textContent);

const click = (target: HTMLElement, label: string) =>
  [...target.querySelectorAll("button")]
    .find((button) => button.textContent === label)
    ?.click();

/** Hydrates a fixture over its real server output, as hydration.browser.test.ts does. */
const hydrateFromServer = async (path: string, component: Component) => {
  const { body, head } = await commands.renderOnServer(path);
  const script = document.createElement("script");
  script.textContent =
    new DOMParser().parseFromString(head, "text/html").querySelector("script")
      ?.textContent ?? "";
  document.head.append(script);
  const target = document.createElement("div");
  target.innerHTML = body;
  document.body.append(target);
  const app = hydrate(component, { props: {}, target });
  onTestFinished(async () => {
    await unmount(app);
    target.remove();
    script.remove();
    Reflect.deleteProperty(window, "__svelte");
  });
  return target;
};

describe("ScopedAtom with server rendering", () => {
  beforeAll(async () => {
    await commands.renderOnServer("/test/fixtures/ssr-scoped-remount.svelte");
  }, 120_000);

  test("a serializable scoped atom keyed by its input hydrates, then survives a remount of its provider", async () => {
    scopedComputed.length = 0;
    const target = await hydrateFromServer(
      "/test/fixtures/ssr-scoped-remount.svelte",
      SsrScopedRemount
    );
    await expect
      .poll(outputs(target))
      .toEqual(["a from the server", "b from the server"]);
    expect(scopedComputed).toEqual([]);

    click(target, "remount");
    await expect
      .poll(outputs(target))
      .toEqual(["a from the server", "b from the server"]);
    // The new provider's atom reads the value the old one left under the key: nothing ran again.
    await sleep("50 millis");
    expect(outputs(target)()).toEqual([
      "a from the server",
      "b from the server",
    ]);
    expect(scopedComputed).toEqual([]);
  });

  test("without server rendering, remounting the provider of a serializable scoped atom neither throws nor warns", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    onTestFinished(() => warn.mockRestore());
    const screen = await render(SsrScopedRemount);
    const target = screen.container as HTMLElement;
    await expect
      .poll(outputs(target))
      .toEqual(["a from the browser", "b from the browser"]);
    click(target, "remount");
    await expect
      .poll(outputs(target))
      .toEqual(["a from the browser", "b from the browser"]);
    // The old provider is gone once the remount commits, so nothing holds the key twice.
    await sleep("50 millis");
    expect(warn).not.toHaveBeenCalled();
  });

  test("a remounted provider whose old branch is still fading out renders the new one", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    onTestFinished(() => warn.mockRestore());
    const screen = await render(ScopedRemountFade);
    const target = screen.container as HTMLElement;
    await expect.poll(outputs(target)).toEqual(["a from the browser"]);
    click(target, "remount");
    // Both branches are alive while the old one fades out, then only the new one is left.
    await expect
      .poll(outputs(target))
      .toEqual(["a from the browser", "a from the browser"]);
    await expect
      .poll(outputs(target), { timeout: 5000 })
      .toEqual(["a from the browser"]);
    expect(warn).not.toHaveBeenCalled();
  });
});

/** The text of each <output> in server-rendered HTML. */
const serverOutputs = (body: string) =>
  [
    ...new DOMParser()
      .parseFromString(body, "text/html")
      .querySelectorAll("output"),
  ].map((output) => output.textContent);

describe("a family for data that belongs to an id", () => {
  beforeAll(async () => {
    await commands.renderOnServer("/test/fixtures/ssr-family-thread.svelte");
  }, 120_000);

  test("a list that repeats an id renders on the server and hydrates without computing", async () => {
    familyComputed.length = 0;
    const { body } = await commands.renderOnServer(
      "/test/fixtures/ssr-family-thread.svelte"
    );
    expect(serverOutputs(body)).toEqual([
      "a from the server",
      "b from the server",
      "a from the server",
    ]);
    const target = await hydrateFromServer(
      "/test/fixtures/ssr-family-thread.svelte",
      SsrFamilyThread
    );
    await expect
      .poll(outputs(target))
      .toEqual(["a from the server", "b from the server", "a from the server"]);
    expect(familyComputed).toEqual([]);
  });
});

describe("ScopedAtom providing a family's atom", () => {
  beforeAll(async () => {
    await commands.renderOnServer("/test/fixtures/ssr-scoped-family.svelte");
  }, 120_000);

  test("two providers of one input make two different atoms with one key, which fails the server render", async () => {
    // Thrown during the render, past any boundary: the whole render fails.
    await expect(
      commands.renderOnServer("/test/fixtures/ssr-scoped-same-input.svelte")
    ).rejects.toThrow(
      'Two different atoms share the serialization key "scoped-user-a"'
    );
  });

  test("two providers of one input share the family's atom: the server renders both, and the browser hydrates without computing", async () => {
    familyComputed.length = 0;
    const { body } = await commands.renderOnServer(
      "/test/fixtures/ssr-scoped-family.svelte"
    );
    expect(serverOutputs(body)).toEqual([
      "a from the server",
      "a from the server",
      "b from the server",
    ]);
    const target = await hydrateFromServer(
      "/test/fixtures/ssr-scoped-family.svelte",
      SsrScopedFamily
    );
    await expect
      .poll(outputs(target))
      .toEqual(["a from the server", "a from the server", "b from the server"]);
    expect(familyComputed).toEqual([]);

    // The remounted provider gets the same atom from the family, still holding the server's value.
    click(target, "remount");
    await sleep("50 millis");
    expect(outputs(target)()).toEqual([
      "a from the server",
      "a from the server",
      "b from the server",
    ]);
    expect(familyComputed).toEqual([]);
  });
});
