import { hydrate, unmount } from "svelte";
import type { Component } from "svelte";
import { beforeAll, describe, expect, onTestFinished, test, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { commands } from "vitest/browser";

import ScopedRemountFade from "./fixtures/scoped-remount-fade.svelte";
import { scopedComputed } from "./fixtures/scoped-seed.ts";
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
      .toEqual([expect.stringMatching(/^a from the /u), "b from the server"]);
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
    await expect.poll(outputs(target)).toEqual(["a from the browser"]);
    await sleep("200 millis");
    expect(outputs(target)()).toEqual(["a from the browser"]);
  });
});
