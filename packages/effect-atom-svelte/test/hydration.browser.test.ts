import { Deferred, Effect, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry, Hydration } from "effect/reactivity";
import { hydrate, unmount } from "svelte";
import type { Component } from "svelte";
import { describe, expect, onTestFinished, test } from "vitest";
import { render } from "vitest-browser-svelte";
import { commands } from "vitest/browser";

import { useAtomSuspense, useAtomValue } from "../src/index.ts";
import Hydrate from "./fixtures/hydrate.svelte";
import { queryFetches } from "./fixtures/reactive-query.ts";
import { computed } from "./fixtures/seeded-list.ts";
import SsrHydrateResult from "./fixtures/ssr-hydrate-result.svelte";
import SsrHydrate from "./fixtures/ssr-hydrate.svelte";
import SsrReactive from "./fixtures/ssr-reactive.svelte";
import SsrSharedSeed from "./fixtures/ssr-shared-seed.svelte";
import ToggleScriptAwait from "./fixtures/toggle-script-await.svelte";
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
  const { body, head } = await commands.renderOnServer(path);
  const script = document.createElement("script");
  script.textContent =
    new DOMParser().parseFromString(head, "text/html").querySelector("script")
      ?.textContent ?? "";
  document.head.append(script);
  beforeHydrate?.();
  const target = document.createElement("div");
  target.innerHTML = body;
  document.body.append(target);
  const app = hydrate(component as Component, {
    props: props ?? {},
    target,
  });
  onTestFinished(async () => {
    await unmount(app);
    target.remove();
    script.remove();
    Reflect.deleteProperty(window, "__svelte");
  });
  return target;
};

describe("hydrating server output", () => {
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

  test("leaving before the first fetch lands, then coming back, fetches again", async () => {
    const registry = AtomRegistry.make();
    const { options, screen: rendering } = renderCounted(registry, false);
    const screen = await rendering;
    await screen.rerender({ show: false });
    // Long enough for the fetch to land and the node to be swept.
    await sleep(`${fetchMillis + 50} millis`);
    expect(registry.getNodes().has("fetches")).toBe(false);
    options.read = true;
    await screen.rerender({ show: true });
    await expect.poll(text(screen)).toBe("2");
  });
});
