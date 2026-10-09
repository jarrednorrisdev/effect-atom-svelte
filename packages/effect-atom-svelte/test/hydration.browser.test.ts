import { Deferred, Effect, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry, Hydration } from "effect/reactivity";
import { hydrate, unmount } from "svelte";
import type { Component } from "svelte";
import { beforeAll, describe, expect, onTestFinished, test, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { commands } from "vitest/browser";

import { useAtomSuspense, useAtomValue } from "../src/index.ts";
import HydratePending from "./fixtures/hydrate-pending.svelte";
import Hydrate from "./fixtures/hydrate.svelte";
import { pendingBoundaryComputed } from "./fixtures/pending-boundary.ts";
import { providerSeedSeen } from "./fixtures/provider-seed.ts";
import { queryFetches } from "./fixtures/reactive-query.ts";
import {
  resetRevalidate,
  revalidateComputed,
  revalidateSeen,
} from "./fixtures/revalidate.ts";
import { computed, listFor } from "./fixtures/seeded-list.ts";
import { serverValueComputed } from "./fixtures/server-value.ts";
import { skewComputed } from "./fixtures/skew-seed.ts";
import SsrAfterAwait from "./fixtures/ssr-after-await.svelte";
import SsrAwaitedBoundary from "./fixtures/ssr-awaited-boundary.svelte";
import SsrBoundaryReadAbove from "./fixtures/ssr-boundary-read-above.svelte";
import SsrBrowserChoice from "./fixtures/ssr-browser-choice.svelte";
import SsrHydrateRefresh from "./fixtures/ssr-hydrate-refresh.svelte";
import SsrHydrateResult from "./fixtures/ssr-hydrate-result.svelte";
import SsrHydrate from "./fixtures/ssr-hydrate.svelte";
import SsrPendingBoundaryChild from "./fixtures/ssr-pending-boundary-child.svelte";
import SsrPendingBoundary from "./fixtures/ssr-pending-boundary.svelte";
import SsrProviderSeed from "./fixtures/ssr-provider-seed.svelte";
import SsrReactive from "./fixtures/ssr-reactive.svelte";
import SsrRevalidate from "./fixtures/ssr-revalidate.svelte";
import SsrScriptRead from "./fixtures/ssr-script-read.svelte";
import SsrServerValue from "./fixtures/ssr-server-value.svelte";
import SsrSharedSeed from "./fixtures/ssr-shared-seed.svelte";
import SsrSkewSeed from "./fixtures/ssr-skew-seed.svelte";
import SsrStreamSeed from "./fixtures/ssr-stream-seed.svelte";
import SsrUnsentAfterAwait from "./fixtures/ssr-unsent-after-await.svelte";
import SsrUnsentSeed from "./fixtures/ssr-unsent-seed.svelte";
import SsrValueAndSuspense from "./fixtures/ssr-value-and-suspense.svelte";
import ToggleScriptAwait from "./fixtures/toggle-script-await.svelte";
import TwoBoundaries from "./fixtures/two-boundaries.svelte";
import {
  resetUnsent,
  streamSeen,
  unsentComputed,
} from "./fixtures/unsent-seed.ts";
import { sleep, text } from "./helpers.ts";

interface ServerOutput {
  readonly body: string;
  readonly head: string;
}

declare module "vitest/browser" {
  interface BrowserCommands {
    /** Defined in vitest.config.ts. */
    renderOnServer: (path: string) => Promise<ServerOutput>;
  }
}

const countAtom = Atom.make(0).pipe(
  Atom.serializable({ key: "count", schema: Schema.Number })
);

/** Simulates the server: computes atoms in a registry and dehydrates it through JSON. */
const serverState = (
  atoms: readonly Atom.Atom<unknown>[],
  setup: (registry: AtomRegistry.AtomRegistry) => void,
  options?: Parameters<typeof Hydration.dehydrate>[1]
) => {
  const registry = AtomRegistry.make();
  for (const atom of atoms) {
    registry.mount(atom);
  }
  setup(registry);
  return Hydration.dehydrate(registry, options);
};

const readCount = () => {
  const count = useAtomValue(countAtom);
  return () => count.current;
};

describe("HydrationBoundary", () => {
  test("hydrates atoms that survive a JSON round trip", async () => {
    // oxlint-disable-next-line unicorn/prefer-structured-clone -- the JSON round trip simulates the wire, which structuredClone would not
    const state = JSON.parse(
      JSON.stringify(
        serverState([countAtom], (registry) => registry.set(countAtom, 42))
      )
    );
    const screen = await render(Hydrate, {
      registry: AtomRegistry.make(),
      setup: readCount,
      state,
    });
    await expect.poll(text(screen)).toBe("42");
  });

  test("a state passed after init hydrates too (JND-60)", async () => {
    const registry = AtomRegistry.make();
    const screen = await render(Hydrate, {
      registry,
      setup: readCount,
      state: serverState([countAtom], (server) => server.set(countAtom, 1)),
    });
    await expect.poll(text(screen)).toBe("1");
    await screen.rerender({
      state: serverState([countAtom], (server) => server.set(countAtom, 2)),
    });
    await expect.poll(text(screen)).toBe("2");
  });

  test("an empty or missing state is a no-op", async () => {
    const empty = await render(Hydrate, {
      registry: AtomRegistry.make(),
      setup: readCount,
      state: [],
    });
    await expect.poll(text(empty)).toBe("0");
    const missing = await render(Hydrate, {
      registry: AtomRegistry.make(),
      setup: readCount,
      state: undefined,
    });
    await expect.poll(text(missing)).toBe("0");
  });

  test("new atoms hydrate before children render; existing ones update after", async () => {
    const registry = AtomRegistry.make();
    registry.mount(countAtom);
    registry.set(countAtom, 1);
    const seen: number[] = [];
    const state = serverState([countAtom], (server) =>
      server.set(countAtom, 2)
    );
    const screen = await render(Hydrate, {
      registry,
      setup: () => {
        const count = useAtomValue(countAtom);
        return () => {
          seen.push(count.current);
          return count.current;
        };
      },
      state,
    });
    await expect.poll(text(screen)).toBe("2");
    // The existing atom rendered its current value first, then took the hydrated one.
    expect(seen[0]).toBe(1);
  });

  test("drops the values nobody read when it is destroyed", async () => {
    const registry = AtomRegistry.make();
    const screen = await render(Hydrate, {
      registry,
      setup: () => () => "not read",
      state: serverState([countAtom], (server) => server.set(countAtom, 42)),
    });
    await screen.unmount();
    // Kept, the value would wait in the registry for whoever reads the atom next, however late.
    expect(registry.get(countAtom)).toBe(0);
    registry.dispose();
  });

  test("keeps a value another boundary queued with the same state when it is destroyed", async () => {
    const registry = AtomRegistry.make();
    const state = serverState([countAtom], (server) =>
      server.set(countAtom, 42)
    );
    const screen = await render(TwoBoundaries, {
      atom: countAtom,
      readSecond: false,
      registry,
      showFirst: true,
      state,
    });
    // As a layout and its page given the same state: the first goes before the second's child reads.
    await screen.rerender({ showFirst: false });
    await screen.rerender({ readSecond: true });
    await expect
      .poll(() => screen.container.querySelector("output")?.textContent)
      .toBe("42");
    registry.dispose();
  });

  test("leaves a value another boundary queued since when it drops its own", async () => {
    const registry = AtomRegistry.make();
    const first = await render(Hydrate, {
      registry,
      setup: () => () => "not read",
      state: serverState([countAtom], (server) => server.set(countAtom, 1)),
    });
    await render(Hydrate, {
      registry,
      setup: () => () => "not read",
      state: serverState([countAtom], (server) => server.set(countAtom, 2)),
    });
    await first.unmount();
    expect(registry.get(countAtom)).toBe(2);
  });

  test("an Initial result dehydrated as a promise finishes on the client", async () => {
    const slowAtom = Atom.make(
      Effect.succeed("from server").pipe(Effect.delay("100 millis"))
    ).pipe(
      Atom.serializable({
        key: "slow",
        schema: AsyncResult.Schema({ success: Schema.String }),
      })
    );
    const state = serverState([slowAtom], () => undefined, {
      encodeInitialAs: "promise",
    });
    const screen = await render(Hydrate, {
      registry: AtomRegistry.make(),
      setup: () => {
        const result = useAtomValue(slowAtom);
        return () => result.current._tag;
      },
      state,
    });
    await expect.poll(text(screen)).toBe("Success");
  });
});

describe("HydrationBoundary destroyed before a promise-encoded value lands", () => {
  test("doesn't hand the late value to a later reader", async () => {
    const registry = AtomRegistry.make();
    const late = Deferred.makeUnsafe<unknown>();
    const state = [
      {
        dehydratedAt: 0,
        key: "count",
        resultPromise: Effect.runPromise(Deferred.await(late)),
        value: 0,
        "~effect/reactivity/Hydration/DehydratedAtom": true,
      },
    ] as unknown as Hydration.DehydratedAtom[];
    const screen = await render(Hydrate, {
      registry,
      setup: () => () => "not read",
      state,
    });
    // As a page navigated away from while its streamed state was still on its way.
    await screen.unmount();
    Deferred.doneUnsafe(late, Effect.succeed(42));
    await sleep("20 millis");
    // Kept, the late value would wait in the registry for whoever reads the atom next, however late.
    expect(registry.get(countAtom)).toBe(0);
    registry.dispose();
  });

  test("destroyed while its children are still pending, doesn't hand the late value to a later reader", async () => {
    const registry = AtomRegistry.make();
    const late = Deferred.makeUnsafe<unknown>();
    const state = [
      {
        dehydratedAt: 0,
        key: "count",
        resultPromise: Effect.runPromise(Deferred.await(late)),
        value: 0,
        "~effect/reactivity/Hydration/DehydratedAtom": true,
      },
    ] as unknown as Hydration.DehydratedAtom[];
    const screen = await render(HydratePending, {
      registry,
      // A child that never finishes loading, so the boundary never mounts.
      setup: () => Effect.runPromise(Effect.never),
      show: true,
      state,
    });
    await expect.poll(text(screen)).toBe("pending");
    // As a page navigated away from before it had finished loading.
    await screen.rerender({ show: false });
    await sleep("20 millis");
    Deferred.doneUnsafe(late, Effect.succeed(42));
    await sleep("20 millis");
    expect(registry.get(countAtom)).toBe(0);
    registry.dispose();
  });
});

/** The values the head's hydratable script left for hydration, by key. */
const hydratables = () =>
  (window as unknown as { __svelte: { h: Map<string, unknown> } }).__svelte.h;

const outputs = (target: HTMLElement) => () =>
  [...target.querySelectorAll("output")].map((output) => output.textContent);

const click = (target: HTMLElement, label: string) =>
  [...target.querySelectorAll("button")]
    .find((button) => button.textContent === label)
    ?.click();

/** Long enough for the registry to sweep a node that nothing holds. */
const afterSweep = "50 millis";

/**
 * Hydrates a fixture over its real server output, running the head's hydratable script first.
 * `beforeHydrate` runs between the two, for example to hold back a seed. `props` must not change
 * what the server renders.
 */
const hydrateFromServer = async <Props extends Record<string, unknown>>(
  path: string,
  component: Component<Props>,
  beforeHydrate?: () => void,
  props?: Props
) => {
  // Vitest does not stop a test that times out, so without this its body would hydrate and click
  // through the next test, leaving its own state in the shared fixtures (JND-42).
  const caller = { finished: false };
  onTestFinished(() => {
    caller.finished = true;
  });
  const { body, head } = await commands.renderOnServer(path);
  if (caller.finished) {
    throw new Error(`The test finished before ${path} rendered on the server`);
  }
  const script = document.createElement("script");
  script.textContent =
    new DOMParser().parseFromString(head, "text/html").querySelector("script")
      ?.textContent ?? "";
  document.head.append(script);
  beforeHydrate?.();
  const target = document.createElement("div");
  target.innerHTML = body;
  document.body.append(target);
  const cleanUp = () => {
    target.remove();
    script.remove();
    Reflect.deleteProperty(window, "__svelte");
  };
  try {
    const app = hydrate(component as Component, {
      props: props ?? {},
      target,
    });
    onTestFinished(async () => {
      await unmount(app);
      cleanUp();
    });
  } catch (error) {
    cleanUp();
    throw error;
  }
  return target;
};

describe("hydrating server output", () => {
  // The first server render compiles the library and Effect for SSR, which takes seconds and far
  // longer when the e2e suite shares the CPU (JND-42). Pay for it here, not in the first test.
  beforeAll(async () => {
    await commands.renderOnServer("/test/fixtures/ssr-hydrate.svelte");
  }, 120_000);

  test("useAtomSuspense uses the server's result, then follows its getter", async () => {
    computed.length = 0;
    const target = await hydrateFromServer(
      "/test/fixtures/ssr-hydrate.svelte",
      SsrHydrate
    );
    const output = () => target.querySelector("output")?.textContent;

    await expect.poll(output).toBe("a from the server");
    // The seed is the only source for "a": the browser must not compute it (JND-23).
    expect(computed).toEqual([]);
    target.querySelector("button")?.click();
    await expect.poll(output).toBe("b from the browser");
    expect(computed).toEqual(["b"]);
  });

  test("revalidateOnHydrate fetches an atom without reactivity keys again too (JND-19)", async () => {
    computed.length = 0;
    const target = await hydrateFromServer(
      "/test/fixtures/ssr-hydrate.svelte",
      SsrHydrate,
      undefined,
      { revalidateOnHydrate: true }
    );
    const output = () => target.querySelector("output")?.textContent;

    await expect.poll(output).toBe("a from the browser");
    expect(computed).toEqual(["a"]);
  });

  describe("revalidateOnHydrate (JND-85)", () => {
    test("shows the server's result as waiting while the atom runs again", async () => {
      resetRevalidate();
      const target = await hydrateFromServer(
        "/test/fixtures/ssr-revalidate.svelte",
        SsrRevalidate
      );

      await expect.poll(outputs(target)).toEqual(["browser", "browser"]);
      expect(revalidateSeen).toEqual({
        result: ["server (waiting)", "browser"],
        suspense: ["server (waiting)", "browser"],
      });
      expect(new Set(revalidateComputed)).toEqual(
        new Set(["result", "suspense"])
      );
    });

    // Pins today's behavior. Svelte's hydratable reads the server's values only while it is
    // hydrating, and it stops hydrating at a component script's first await, so a hook called after
    // one gets no seed: its atom runs in the browser like one without a serialization key, and the
    // component keeps the server's markup until it has the browser's result. The development build
    // warns, once per key, and not for a later render that reads the same keys (JND-96).
    test("a hook called after a top-level await gets no seed, and warns", async () => {
      resetRevalidate();
      const warn = vi
        .spyOn(console, "warn")
        .mockImplementation(() => undefined);
      onTestFinished(() => warn.mockRestore());
      const missed = () =>
        warn.mock.calls.filter(([message]) =>
          String(message).includes("got no value from the server")
        );
      const target = await hydrateFromServer(
        "/test/fixtures/ssr-after-await.svelte",
        SsrAfterAwait
      );

      await expect.poll(outputs(target)).toEqual(["server", "browser"]);
      expect(revalidateSeen).toEqual({
        "after-await": ["browser"],
        kept: ["server"],
      });
      expect(revalidateComputed).toEqual(["after-await"]);
      expect(missed()).toHaveLength(1);
      expect(String(missed()[0]?.[0])).toContain('"revalidate-after-await"');

      // As after client-side navigation: the server's values are still on the page, but each key
      // has had its chance.
      const again = await render(SsrAfterAwait);
      await expect
        .poll(() =>
          [...again.container.querySelectorAll("output")].map(
            (o) => o.textContent
          )
        )
        .toEqual(["browser", "browser"]);
      expect(missed()).toHaveLength(1);
    });
  });

  test("useAtomResult uses the server's result, then follows its getter", async () => {
    computed.length = 0;
    const target = await hydrateFromServer(
      "/test/fixtures/ssr-hydrate-result.svelte",
      SsrHydrateResult
    );
    const output = () => target.querySelector("output")?.textContent;

    await expect.poll(output).toBe("a from the server");
    expect(computed).toEqual([]);
    target.querySelector("button")?.click();
    await expect.poll(output).toBe("b from the browser");
    expect(computed).toEqual(["b"]);
  });

  test("an atom also read with useAtomValue takes the server's result without computing again", async () => {
    computed.length = 0;
    const target = await hydrateFromServer(
      "/test/fixtures/ssr-value-and-suspense.svelte",
      SsrValueAndSuspense
    );

    await expect
      .poll(outputs(target))
      .toEqual(["Success", "a from the server"]);
    await sleep(afterSweep);
    expect(computed).toEqual([]);
  });

  test("useAtomResult destroyed before its seed lands computes nothing", async () => {
    computed.length = 0;
    const seed = Deferred.makeUnsafe<unknown>();
    let value: unknown;
    const target = await hydrateFromServer(
      "/test/fixtures/ssr-hydrate-result.svelte",
      SsrHydrateResult,
      () => {
        const store = hydratables();
        value = store.get("seeded-list-a");
        store.set("seeded-list-a", Effect.runPromise(Deferred.await(seed)));
      }
    );
    click(target, "hide");
    await expect.poll(outputs(target)).toEqual([]);
    Deferred.doneUnsafe(seed, Effect.succeed(value));
    await sleep(afterSweep);
    expect(computed).toEqual([]);
  });

  test("atoms with a server value hydrate without a seed, then compute in the browser (JND-58)", async () => {
    serverValueComputed.length = 0;
    const target = await hydrateFromServer(
      "/test/fixtures/ssr-server-value.svelte",
      SsrServerValue
    );

    await expect
      .poll(outputs(target))
      .toEqual(["result from the browser", "suspense from the browser"]);
    expect(new Set(serverValueComputed)).toEqual(
      new Set(["result", "suspense"])
    );
  });

  test("a defect or a value the schema rejects isn't sent, so the browser computes it", async () => {
    resetUnsent();
    const target = await hydrateFromServer(
      "/test/fixtures/ssr-unsent-seed.svelte",
      SsrUnsentSeed
    );

    await expect
      .poll(outputs(target))
      .toEqual(["defect from the browser", "unencodable from the browser"]);
    expect(new Set(unsentComputed)).toEqual(new Set(["defect", "unencodable"]));
  });

  test("a hook after a top-level await doesn't warn about a seed the server didn't send", async () => {
    resetUnsent();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    onTestFinished(() => warn.mockRestore());
    const target = await hydrateFromServer(
      "/test/fixtures/ssr-unsent-after-await.svelte",
      SsrUnsentAfterAwait
    );
    await expect
      .poll(outputs(target))
      .toEqual(["server", "defect from the browser"]);
    await sleep("20 millis");
    const missed = warn.mock.calls.filter(([message]) =>
      String(message).includes("got no value from the server")
    );
    expect(missed).toEqual([]);
  });

  test("a seed the browser can't decode is dropped, so the browser computes the atom", async () => {
    skewComputed.length = 0;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    onTestFinished(() => warn.mockRestore());
    const target = await hydrateFromServer(
      "/test/fixtures/ssr-skew-seed.svelte",
      SsrSkewSeed
    );
    // As for a result the server can't encode: the browser computes it, with nothing unhandled.
    await expect.poll(outputs(target)).toEqual(["skew from the browser"]);
    expect(skewComputed).toEqual(["skew"]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("doesn't decode with its schema"),
      expect.anything()
    );
  });

  test("a stream sent between its values hydrates with the server's value, then runs again", async () => {
    resetUnsent();
    const target = await hydrateFromServer(
      "/test/fixtures/ssr-stream-seed.svelte",
      SsrStreamSeed
    );

    // The server's run ended with the render, so left as it came, it would wait forever.
    await expect.poll(outputs(target)).toEqual(["20"]);
    expect(streamSeen[0]).toBe("3 (waiting)");
    expect(streamSeen).not.toContain("Initial");
  });

  test("a seeded useAtomSuspense read in the script lets go of its atom once the getter moves on", async () => {
    computed.length = 0;
    const registry = AtomRegistry.make();
    const target = await hydrateFromServer(
      "/test/fixtures/ssr-script-read.svelte",
      SsrScriptRead,
      undefined,
      { registry }
    );
    const output = () => target.querySelector("output")?.textContent;
    await expect.poll(output).toBe("a from the server");
    // The server's markup shows "a" before hydration attaches the button's handler.
    await sleep("200 millis");
    click(target, "b");
    await expect
      .poll(() => target.querySelector("span")?.textContent)
      .toBe("b");
    await expect.poll(output).toBe("b from the browser");
    // "a" came from the seed.
    expect(computed).toEqual(["b"]);
    await sleep(afterSweep);
    expect(registry.getNodes().has("seeded-list-a")).toBe(false);
  });

  test("refreshing a hydrated atom computes it in the browser", async () => {
    computed.length = 0;
    const target = await hydrateFromServer(
      "/test/fixtures/ssr-hydrate-refresh.svelte",
      SsrHydrateRefresh
    );
    const output = () => target.querySelector("output")?.textContent;

    await expect.poll(output).toBe("a from the server");
    expect(computed).toEqual([]);
    target.querySelector("button")?.click();
    await expect.poll(output).toBe("a from the browser");
    expect(computed).toEqual(["a"]);
  });

  describe("two components sharing a serialization key", () => {
    const path = "/test/fixtures/ssr-shared-seed.svelte";

    test("the second keeps the seed when the first is destroyed before it lands (JND-36)", async () => {
      computed.length = 0;
      // Held back, so the first is destroyed while the seed is still on its way.
      const seed = Deferred.makeUnsafe<unknown>();
      let value: unknown;
      const target = await hydrateFromServer(path, SsrSharedSeed, () => {
        const store = hydratables();
        value = store.get("seeded-list-a");
        store.set("seeded-list-a", Effect.runPromise(Deferred.await(seed)));
      });
      click(target, "hide first");
      await expect.poll(outputs(target)).toEqual([]);
      Deferred.doneUnsafe(seed, Effect.succeed(value));
      await sleep(afterSweep);
      click(target, "show second");
      await expect.poll(outputs(target)).toEqual(["a from the server"]);
      expect(computed).toEqual([]);
    });

    test("the second keeps the seed when the first is destroyed after it lands (JND-36)", async () => {
      computed.length = 0;
      const target = await hydrateFromServer(path, SsrSharedSeed);
      await expect.poll(outputs(target)).toEqual(["a from the server"]);
      await sleep(afterSweep);
      click(target, "hide first");
      await expect.poll(outputs(target)).toEqual([]);
      await sleep(afterSweep);
      click(target, "show second");
      await expect.poll(outputs(target)).toEqual(["a from the server"]);
      expect(computed).toEqual([]);
    });

    test("a seed that lands after every user is destroyed is dropped (JND-37)", async () => {
      computed.length = 0;
      const seed = Deferred.makeUnsafe<unknown>();
      let value: unknown;
      const target = await hydrateFromServer(path, SsrSharedSeed, () => {
        const store = hydratables();
        value = store.get("seeded-list-a");
        store.set("seeded-list-a", Effect.runPromise(Deferred.await(seed)));
      });
      click(target, "hide first");
      click(target, "remove second");
      await expect.poll(outputs(target)).toEqual([]);
      Deferred.doneUnsafe(seed, Effect.succeed(value));
      await sleep(afterSweep);
      // Kept, it would be applied whenever the atom is next used, however old by then.
      click(target, "show first");
      await expect.poll(outputs(target)).toEqual(["a from the browser"]);
      expect(computed).toEqual(["a"]);
    });

    test("a seed that lands after every reader is destroyed computes nothing for them (JND-37)", async () => {
      computed.length = 0;
      const seed = Deferred.makeUnsafe<unknown>();
      let value: unknown;
      const target = await hydrateFromServer(path, SsrSharedSeed, () => {
        const store = hydratables();
        value = store.get("seeded-list-a");
        store.set("seeded-list-a", Effect.runPromise(Deferred.await(seed)));
      });
      // The first read the atom before its seed landed, then went away.
      click(target, "hide first");
      click(target, "remove second");
      await expect.poll(outputs(target)).toEqual([]);
      Deferred.doneUnsafe(seed, Effect.succeed(value));
      await sleep(afterSweep);
      expect(computed).toEqual([]);
    });

    test("a seed that lands after every user is destroyed leaves an atom others hold alone (JND-37)", async () => {
      computed.length = 0;
      const registry = AtomRegistry.make();
      const seed = Deferred.makeUnsafe<unknown>();
      let value: unknown;
      const target = await hydrateFromServer(
        path,
        SsrSharedSeed,
        () => {
          const store = hydratables();
          value = store.get("seeded-list-a");
          store.set("seeded-list-a", Effect.runPromise(Deferred.await(seed)));
        },
        { registry }
      );
      click(target, "hide first");
      click(target, "remove second");
      await expect.poll(outputs(target)).toEqual([]);
      // Something outside the components holds the atom, and has computed it here.
      const release = registry.mount(listFor("a"));
      onTestFinished(release);
      await expect
        .poll(() => registry.get(listFor("a")))
        .toMatchObject({ _tag: "Success", value: "a from the browser" });
      Deferred.doneUnsafe(seed, Effect.succeed(value));
      await sleep(afterSweep);
      expect(registry.get(listFor("a"))).toMatchObject({
        _tag: "Success",
        value: "a from the browser",
      });
    });

    test("a key spent in a registry gets no seed from a later hydration (JND-37)", async () => {
      computed.length = 0;
      const registry = AtomRegistry.make();
      const first = await hydrateFromServer(path, SsrSharedSeed, undefined, {
        registry,
      });
      await expect.poll(outputs(first)).toEqual(["a from the server"]);
      click(first, "hide first");
      click(first, "remove second");
      await expect.poll(outputs(first)).toEqual([]);
      await sleep(afterSweep);
      expect(registry.getNodes().has("seeded-list-a")).toBe(false);
      // The page still holds the server's value, however old by now.
      const second = await hydrateFromServer(path, SsrSharedSeed, undefined, {
        registry,
      });
      await expect.poll(outputs(second)).toEqual(["a from the browser"]);
      expect(computed).toEqual(["a"]);
    });
  });

  describe("a query with reactivity keys (JND-19)", () => {
    const path = "/test/fixtures/ssr-reactive.svelte";
    /** Longer than a fetch, so a refetch after hydration would have landed. */
    const afterFetch = "100 millis";

    test("keeps the server's value instead of fetching again", async () => {
      queryFetches.count = 0;
      const target = await hydrateFromServer(path, SsrReactive);
      await expect.poll(outputs(target)).toEqual(["server", "server"]);
      await sleep(afterFetch);
      expect(outputs(target)()).toEqual(["server", "server"]);
      expect(queryFetches.count).toBe(0);
    });

    test("still fetches again after a mutation on its keys", async () => {
      queryFetches.count = 0;
      const target = await hydrateFromServer(path, SsrReactive);
      await expect.poll(outputs(target)).toEqual(["server", "server"]);
      click(target, "mutate");
      await expect.poll(outputs(target)).toEqual(["browser 1", "browser 1"]);
      expect(queryFetches.count).toBe(1);
    });

    test.each([
      ["RegistryProvider", { provider: true }],
      ["the hooks", { hook: true }],
    ])(
      "revalidateOnHydrate on %s fetches once after hydration",
      async (_, props) => {
        queryFetches.count = 0;
        const target = await hydrateFromServer(
          path,
          SsrReactive,
          undefined,
          props
        );
        await expect.poll(outputs(target)).toEqual(["browser 1", "browser 1"]);
        await sleep(afterFetch);
        expect(queryFetches.count).toBe(1);
      }
    );

    test("the hooks' option overrides the provider's", async () => {
      queryFetches.count = 0;
      const target = await hydrateFromServer(path, SsrReactive, undefined, {
        hook: false,
        provider: true,
      });
      await expect.poll(outputs(target)).toEqual(["server", "server"]);
      await sleep(afterFetch);
      expect(queryFetches.count).toBe(0);
    });
  });

  describe("a serializable atom read inside a boundary with a pending snippet (JND-86)", () => {
    test("with the hook outside the boundary, the browser uses the server's embedded result", async () => {
      pendingBoundaryComputed.length = 0;
      const target = await hydrateFromServer(
        "/test/fixtures/ssr-pending-boundary.svelte",
        SsrPendingBoundary
      );

      await expect.poll(outputs(target)).toEqual(["from the server"]);
      expect(pendingBoundaryComputed).toEqual([]);
    });

    test("with the hook in a component inside the boundary, the browser fetches it", async () => {
      pendingBoundaryComputed.length = 0;
      const target = await hydrateFromServer(
        "/test/fixtures/ssr-pending-boundary-child.svelte",
        SsrPendingBoundaryChild
      );

      await expect.poll(outputs(target)).toEqual(["from the browser"]);
      expect(pendingBoundaryComputed).toEqual(["browser"]);
    });
  });

  test("a HydrationBoundary with awaited state hydrates a query with reactivity keys (JND-95)", async () => {
    queryFetches.count = 0;
    const errors: unknown[] = [];
    const onError = (event: ErrorEvent) => {
      errors.push(event.error ?? event.message);
    };
    window.addEventListener("error", onError);
    onTestFinished(() => window.removeEventListener("error", onError));
    const target = await hydrateFromServer(
      "/test/fixtures/ssr-awaited-boundary.svelte",
      SsrAwaitedBoundary
    );

    // HydrationBoundary keeps Effect's Hydration.hydrate behavior: a query wrapped by withReactivity
    // runs again in the browser, building its outer atom as the child first reads it.
    await expect.poll(outputs(target)).toEqual(["browser 1"]);
    expect(queryFetches.count).toBe(1);
    // Long enough for Svelte to commit the hydration and everything it scheduled. Its dev build used
    // to throw "Batch has scheduled effects" while committing the update that first build announced.
    await sleep("100 millis");
    expect(errors).toEqual([]);
  });

  describe("a getter that picks a different atom in the browser (JND-24)", () => {
    const path = "/test/fixtures/ssr-browser-choice.svelte";

    test("fails hydration: the browser's atom has no server value", async () => {
      // Svelte throws in dev; a production build warns and fetches instead.
      await expect(hydrateFromServer(path, SsrBrowserChoice)).rejects.toThrow(
        "hydratable_missing_but_required"
      );
    });

    test("keeping the server's choice until mounted uses the seed, then switches", async () => {
      computed.length = 0;
      const target = await hydrateFromServer(
        path,
        SsrBrowserChoice,
        undefined,
        { afterMount: true }
      );
      const output = () => target.querySelector("output")?.textContent;

      await expect.poll(output).toBe("b from the browser");
      // "a" came from the seed; only the browser's own choice was fetched.
      expect(computed).toEqual(["b"]);
    });
  });
});

const fetchMillis = 100;

/** A serializable atom whose value counts how often it was fetched. */
const counted = () => {
  let fetches = 0;
  return Atom.make(
    Effect.sync(() => {
      fetches += 1;
      return fetches;
    }).pipe(Effect.delay(`${fetchMillis} millis`))
  ).pipe(
    Atom.serializable({
      key: "fetches",
      schema: AsyncResult.Schema({ success: Schema.Number }),
    })
  );
};

/** Mounts a component using the atom; it awaits the atom's result only while `read` is set. */
const renderCounted = (registry: AtomRegistry.AtomRegistry, read: boolean) => {
  const atom = counted();
  const options = { read };
  const screen = render(ToggleScriptAwait, {
    registry,
    setup: async () => {
      const value = useAtomSuspense(atom);
      return options.read ? await value.current : "not read";
    },
    show: true,
  });
  return { options, screen };
};

describe("seeding after client-side navigation", () => {
  // Nothing is hydrating, so hydratable fetches in the browser; that value is no seed (JND-37).
  test("coming back after the node is disposed fetches again", async () => {
    const registry = AtomRegistry.make();
    const { screen: rendering } = renderCounted(registry, true);
    const screen = await rendering;
    await expect.poll(text(screen)).toBe("1");
    await screen.rerender({ show: false });
    await sleep(afterSweep);
    expect(registry.getNodes().has("fetches")).toBe(false);
    await screen.rerender({ show: true });
    await expect.poll(text(screen)).toBe("2");
  });

  test("leaving before the first fetch lands interrupts it, and coming back fetches again", async () => {
    const registry = AtomRegistry.make();
    const { options, screen: rendering } = renderCounted(registry, false);
    const screen = await rendering;
    await screen.rerender({ show: false });
    // Long enough for the fetch to have landed, had it not been interrupted (JND-57).
    await sleep(`${fetchMillis + 50} millis`);
    expect(registry.getNodes().has("fetches")).toBe(false);
    options.read = true;
    await screen.rerender({ show: true });
    await expect.poll(text(screen)).toBe("1");
  });

  test("a useAtomSuspense read in the script lets go of its atom once the getter moves on", async () => {
    computed.length = 0;
    const registry = AtomRegistry.make();
    const screen = await render(SsrScriptRead, { registry });
    const output = () => screen.container.querySelector("output")?.textContent;
    await expect.poll(output).toBe("a from the browser");
    click(screen.container as HTMLElement, "b");
    await expect.poll(output).toBe("b from the browser");
    await sleep(afterSweep);
    expect(registry.getNodes().has("seeded-list-a")).toBe(false);
  });
});

describe("RegistryProvider initialValues with a HydrationBoundary", () => {
  test("the browser's first render shows what the server rendered, the boundary's value", async () => {
    providerSeedSeen.length = 0;
    const { body } = await commands.renderOnServer(
      "/test/fixtures/ssr-provider-seed.svelte"
    );
    // The server renders the boundary's value over the provider's default.
    expect(
      new DOMParser()
        .parseFromString(body, "text/html")
        .body.textContent?.trim()
    ).toBe("2");
    const target = await hydrateFromServer(
      "/test/fixtures/ssr-provider-seed.svelte",
      SsrProviderSeed
    );
    await expect
      .poll(() => target.querySelector("output")?.textContent)
      .toBe("2");
    // Hydration must start from the server's markup, not flash the provider's default.
    expect(providerSeedSeen).toEqual([2]);
  }, 120_000);

  test("an atom read above the boundary: the boundary's children hydrate with what the server rendered", async () => {
    providerSeedSeen.length = 0;
    const { body } = await commands.renderOnServer(
      "/test/fixtures/ssr-boundary-read-above.svelte"
    );
    const server = [
      ...new DOMParser()
        .parseFromString(body, "text/html")
        .querySelectorAll("output"),
    ].map((output) => output.textContent);
    expect(server).toEqual(["above 0", "2"]);
    const target = await hydrateFromServer(
      "/test/fixtures/ssr-boundary-read-above.svelte",
      SsrBoundaryReadAbove
    );
    await expect.poll(outputs(target)).toEqual(["above 2", "2"]);
    expect(providerSeedSeen).toEqual([2]);
  }, 120_000);
});
