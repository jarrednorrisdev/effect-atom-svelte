import type { Exit } from "effect";
import { Context, Effect, Layer, Schema, SubscriptionRef } from "effect";
import { KeyValueStore } from "effect/persistence";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";
import { describe, expect, test } from "vitest";
import { render } from "vitest-browser-svelte";

import { useAtom, useAtomSet, useAtomValue } from "../src/index.ts";
import Harness from "./fixtures/harness.svelte";
import Toggle from "./fixtures/toggle.svelte";
import { sleep, text, tracked } from "./helpers.ts";

const successOr = <A>(
  result: AsyncResult.AsyncResult<A, unknown>,
  fallback: string
) =>
  AsyncResult.match(result, {
    onFailure: () => "failed",
    onInitial: () => fallback,
    onSuccess: ({ value }) => String(value),
  });

class TheNumber extends Context.Service<TheNumber, { readonly n: number }>()(
  "test/TheNumber"
) {
  static readonly layer = Layer.succeed(TheNumber, { n: 42 });
}

describe("runtimes and services", () => {
  test("a runtime atom reads its layer, and initialValue swaps in a test layer", async () => {
    const runtime = Atom.runtime(TheNumber.layer);
    const numberAtom = runtime.atom(
      TheNumber.use((service) => Effect.succeed(service.n))
    );
    const setup = () => {
      const value = useAtomValue(numberAtom);
      return () => successOr(value.current, "initial");
    };
    const real = await render(Harness, { setup });
    await expect.poll(text(real)).toBe("42");
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(runtime.layer, Layer.succeed(TheNumber, { n: 69 })),
      ],
    });
    const fake = await render(Harness, { registry, setup });
    await expect.poll(text(fake)).toBe("69");
  });
});

describe("Atom.fn", () => {
  test("a new call supersedes the one in flight; both callers see the latest result", async () => {
    const slow = Atom.fn((n: number) =>
      Effect.succeed(n).pipe(Effect.delay("100 millis"))
    );
    let run!: (n: number) => Promise<Exit.Exit<number, unknown>>;
    let set!: (value: number | typeof Atom.Reset) => void;
    const screen = await render(Harness, {
      setup: () => {
        const result = useAtomValue(slow);
        run = useAtomSet(slow, { mode: "promiseExit" });
        set = useAtomSet(slow);
        return () => successOr(result.current, "initial");
      },
    });
    const first = run(1);
    const second = run(2);
    // Promise modes wait for the atom's next settled result, as in @effect/atom-react, so the
    // superseded call resolves with the call that replaced it.
    expect(await first).toMatchObject({ _tag: "Success", value: 2 });
    expect(await second).toMatchObject({ _tag: "Success", value: 2 });
    await expect.poll(text(screen)).toBe("2");
    set(Atom.Reset);
    await expect.poll(text(screen)).toBe("initial");
  });

  test("fnSync runs synchronously", async () => {
    const double = Atom.fnSync((n: number) => n * 2);
    let set!: (n: number) => void;
    const screen = await render(Harness, {
      setup: () => {
        const value = useAtomValue(double);
        set = useAtomSet(double);
        return () => String(value.current);
      },
    });
    set(21);
    await expect.poll(text(screen)).toContain("42");
  });
});

describe("lifetimes", () => {
  test("keepAlive survives its last reader unmounting", async () => {
    const registry = AtomRegistry.make();
    const log: string[] = [];
    const atom = Atom.keepAlive(tracked(log));
    const setup = () => {
      const value = useAtomValue(atom);
      return () => value.current;
    };
    const screen = await render(Toggle, { registry, setup, show: true });
    await screen.rerender({ show: false });
    await sleep("50 millis");
    expect(log).toEqual(["start"]);
  });

  test("setIdleTTL keeps the atom for the TTL after unmount, then disposes it", async () => {
    const registry = AtomRegistry.make();
    const log: string[] = [];
    const atom = Atom.setIdleTTL(tracked(log), "150 millis");
    const setup = () => {
      const value = useAtomValue(atom);
      return () => value.current;
    };
    const screen = await render(Toggle, { registry, setup, show: true });
    await screen.rerender({ show: false });
    await sleep("50 millis");
    expect(log).toEqual(["start"]);
    await expect.poll(() => log, { timeout: 2000 }).toEqual(["start", "stop"]);
  });
});

describe("derived atoms", () => {
  test("family returns one atom per key", () => {
    const byId = Atom.family((id: number) => Atom.make(id * 2));
    expect(byId(1)).toBe(byId(1));
    expect(byId(1)).not.toBe(byId(2));
  });

  test("map, mapResult and transform follow their source", async () => {
    const registry = AtomRegistry.make();
    const base = Atom.make(2);
    const asyncBase = Atom.make((get) => Effect.succeed(get(base)));
    const mapped = base.pipe(Atom.map((n) => n + 1));
    const mappedResult = Atom.mapResult(asyncBase, (n) => n * 10);
    const transformed = Atom.transform(base, (get) => `n=${get(base)}`);
    const screen = await render(Harness, {
      registry,
      setup: () => {
        const a = useAtomValue(mapped);
        const b = useAtomValue(mappedResult);
        const c = useAtomValue(transformed);
        return () => `${a.current} ${successOr(b.current, "-")} ${c.current}`;
      },
    });
    await expect.poll(text(screen)).toBe("3 20 n=2");
    registry.set(base, 5);
    await expect.poll(text(screen)).toBe("6 50 n=5");
  });

  test("debounce only passes the last value through", async () => {
    const registry = AtomRegistry.make();
    const input = Atom.make("");
    const debounced = Atom.debounce(input, "80 millis");
    const screen = await render(Harness, {
      registry,
      setup: () => {
        const value = useAtomValue(debounced);
        return () => `[${value.current}]`;
      },
    });
    registry.set(input, "a");
    registry.set(input, "ab");
    registry.set(input, "abc");
    await sleep("30 millis");
    expect(text(screen)()).toBe("[]");
    await expect.poll(text(screen)).toBe("[abc]");
  });

  test("subscriptionRef reflects changes made through Effect", async () => {
    const ref = Effect.runSync(SubscriptionRef.make(1));
    const atom = Atom.subscriptionRef(ref);
    const screen = await render(Harness, {
      setup: () => {
        const value = useAtomValue(atom);
        return () => value.current;
      },
    });
    await expect.poll(text(screen)).toBe("1");
    Effect.runSync(SubscriptionRef.set(ref, 2));
    await expect.poll(text(screen)).toBe("2");
  });
});

describe("browser-backed atoms", () => {
  test("kvs persists through a KeyValueStore", async () => {
    const store = Effect.runSync(
      Effect.gen(function* getStore() {
        return yield* KeyValueStore.KeyValueStore;
      }).pipe(Effect.provide(KeyValueStore.layerMemory))
    );
    const runtime = Atom.runtime(
      Layer.succeed(KeyValueStore.KeyValueStore, store)
    );
    const theme = Atom.kvs({
      defaultValue: () => "light",
      key: "theme",
      runtime,
      schema: Schema.String,
    });
    let state!: { current: string };
    const screen = await render(Harness, {
      setup: () => {
        state = useAtom(theme);
        return () => state.current;
      },
    });
    await expect.poll(text(screen)).toBe("light");
    state.current = "dark";
    await expect.poll(text(screen)).toBe("dark");
    await expect
      .poll(() => Effect.runPromise(store.get("theme")))
      .toContain("dark");
  });

  test("searchParam reads and writes the URL", async () => {
    const query = Atom.searchParam("q");
    let state!: { current: string };
    const screen = await render(Harness, {
      setup: () => {
        state = useAtom(query);
        return () => `[${state.current}]`;
      },
    });
    state.current = "svelte";
    await expect.poll(text(screen)).toBe("[svelte]");
    await expect
      .poll(() => new URLSearchParams(window.location.search).get("q"))
      .toBe("svelte");
  });

  test("refreshOnWindowFocus recomputes when the page becomes visible", async () => {
    let computed = 0;
    const atom = Atom.refreshOnWindowFocus(
      Atom.make(() => {
        computed += 1;
        return computed;
      })
    );
    const screen = await render(Harness, {
      setup: () => {
        const value = useAtomValue(atom);
        return () => value.current;
      },
    });
    await expect.poll(text(screen)).toBe("1");
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("visibilitychange"));
    await expect.poll(text(screen)).toBe("2");
  });
});
