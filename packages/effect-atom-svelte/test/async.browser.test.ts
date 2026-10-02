import { Effect } from "effect";
import { Atom, AtomRegistry } from "effect/reactivity";
import { describe, expect, test } from "vitest";
import { render } from "vitest-browser-svelte";

import {
  useAtomRefresh,
  useAtomResult,
  useAtomSuspense,
  useAtomValue,
} from "../src/index.ts";
import Harness from "./fixtures/harness.svelte";
import SequentialAwaits from "./fixtures/sequential-awaits.svelte";
import StateGetter from "./fixtures/state-getter.svelte";
import { sleep } from "./helpers.ts";

const text = (screen: Awaited<ReturnType<typeof render>>) => () =>
  screen.container.textContent?.trim();

const delayed = <A>(value: A, millis = 50) =>
  Atom.make(Effect.succeed(value).pipe(Effect.delay(`${millis} millis`)));

describe("useAtomSuspense", () => {
  test("shows the boundary's pending state, then the value", async () => {
    const atom = delayed(5, 150);
    const screen = await render(Harness, {
      async: true,
      setup: () => {
        const value = useAtomSuspense(atom);
        return () => value.current;
      },
    });
    await expect.poll(text(screen)).toBe("pending");
    await expect.poll(text(screen)).toBe("5");
  });

  test("a failure reaches the boundary's failed snippet", async () => {
    const atom = Atom.make(Effect.fail(new Error("boom")));
    const screen = await render(Harness, {
      async: true,
      setup: () => {
        const value = useAtomSuspense(atom);
        return () => value.current;
      },
    });
    await expect.poll(text(screen)).toBe("failed: boom");
  });

  test("includeFailure resolves with the Failure instead of rejecting", async () => {
    const atom = Atom.make(Effect.fail("nope" as const));
    const screen = await render(Harness, {
      async: true,
      setup: () => {
        const value = useAtomSuspense(atom, { includeFailure: true });
        return async () => {
          const result = await value.current;
          return result._tag;
        };
      },
    });
    await expect.poll(text(screen)).toBe("Failure");
  });

  test("returns the same promise while the result is unchanged", async () => {
    const atom = delayed("a");
    const promises: Promise<string>[] = [];
    const screen = await render(Harness, {
      async: true,
      setup: () => {
        const value = useAtomSuspense(atom);
        return () => {
          promises.push(value.current, value.current);
          return value.current;
        };
      },
    });
    await expect.poll(text(screen)).toBe("a");
    const [first, second] = promises.slice(-2);
    expect(first).toBe(second);
  });

  test("a refresh re-runs the await and shows the new value", async () => {
    let calls = 0;
    const atom = Atom.make(
      Effect.sync(() => {
        calls += 1;
        return calls;
      }).pipe(Effect.delay("20 millis"))
    );
    let refresh!: () => void;
    const screen = await render(Harness, {
      async: true,
      setup: () => {
        const value = useAtomSuspense(atom);
        refresh = useAtomRefresh(atom);
        return () => value.current;
      },
    });
    await expect.poll(text(screen)).toBe("1");
    refresh();
    await expect.poll(text(screen)).toBe("2");
  });

  test("follows a getter to a different atom", async () => {
    const registry = AtomRegistry.make();
    const pick = Atom.make(false);
    const first = delayed("first");
    const second = delayed("second");
    const screen = await render(Harness, {
      async: true,
      registry,
      setup: () => {
        const value = useAtomSuspense(() =>
          registry.get(pick) ? second : first
        );
        return () => value.current;
      },
    });
    await expect.poll(text(screen)).toBe("first");
  });

  test("a getter switch reads only the new atom", async () => {
    const registry = AtomRegistry.make();
    const pick = Atom.make("a");
    const computed: string[] = [];
    const named = Atom.family((name: string) =>
      Atom.make(() => {
        computed.push(name);
        return Effect.succeed(name).pipe(Effect.delay("20 millis"));
      })
    );
    const screen = await render(Harness, {
      async: true,
      registry,
      setup: () => {
        const choice = useAtomValue(pick);
        const value = useAtomSuspense(() => named(choice.current));
        return () => value.current;
      },
    });
    await expect.poll(text(screen)).toBe("a");
    registry.set(pick, "b");
    await expect.poll(text(screen)).toBe("b");
    await sleep("100 millis");
    // Svelte renders some batches with pending changes rolled back; none of those renders may pick
    // the released "a" again (JND-23).
    expect(computed).toEqual(["a", "b"]);
    expect(text(screen)()).toBe("b");
  });

  test("a getter over component state follows the new atom and its updates", async () => {
    const registry = AtomRegistry.make();
    const computed: string[] = [];
    const named = Atom.family((name: string) =>
      Atom.make(() => {
        computed.push(name);
        const count = computed.filter((entry) => entry === name).length;
        return Effect.succeed(`${name}${count}`).pipe(
          Effect.delay("20 millis")
        );
      })
    );
    const screen = await render(StateGetter, { named, registry });
    await expect.poll(text(screen)).toBe("b a1");
    screen.container.querySelector("button")?.click();
    await expect.poll(text(screen)).toBe("b b1");
    // The subscription must have moved to "b", or this refresh would not reach the page.
    registry.refresh(named("b"));
    await expect.poll(text(screen)).toBe("b b2");
  });
});

describe("useAtomResult", () => {
  test("hooks can be called between top-level awaits in a component script", async () => {
    const screen = await render(SequentialAwaits, {
      first: delayed("one", 30),
      plain: Atom.make(2),
      second: delayed("three", 30),
    });
    await expect.poll(text(screen)).toBe("one 2 three false");
  });

  test("awaits the first result, then stays live", async () => {
    const registry = AtomRegistry.make();
    const atom = Atom.make(Effect.succeed(1).pipe(Effect.delay("100 millis")));
    const writable = Atom.make(0);
    const derived = Atom.make((get) => get(writable) + 10);
    const screen = await render(Harness, {
      async: true,
      registry,
      setup: async () => {
        const [result, live] = await Promise.all([
          useAtomResult(atom),
          useAtomResult(Atom.make((get) => Effect.succeed(get(derived)))),
        ]);
        return () =>
          `${result.current._tag}:${result.current._tag === "Success" ? result.current.value : ""} ${
            live.current._tag === "Success" ? live.current.value : ""
          }`;
      },
    });
    await expect.poll(text(screen)).toBe("pending");
    await expect.poll(text(screen)).toBe("Success:1 10");
    registry.set(writable, 5);
    await expect.poll(text(screen)).toBe("Success:1 15");
  });

  test("shows waiting while refreshing and keeps the previous value", async () => {
    let calls = 0;
    const atom = Atom.make(
      Effect.sync(() => {
        calls += 1;
        return calls;
      }).pipe(Effect.delay("150 millis"))
    );
    let refresh!: () => void;
    const screen = await render(Harness, {
      async: true,
      setup: async () => {
        refresh = useAtomRefresh(atom);
        const result = await useAtomResult(atom);
        return () =>
          result.current._tag === "Success"
            ? `${result.current.value}${result.current.waiting ? " waiting" : ""}`
            : result.current._tag;
      },
    });
    await expect.poll(text(screen)).toBe("1");
    refresh();
    await expect.poll(text(screen)).toBe("1 waiting");
    await expect.poll(text(screen)).toBe("2");
  });
});
