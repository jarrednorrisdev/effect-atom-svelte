import { Effect } from "effect";
import { Atom, AtomRegistry } from "effect/reactivity";
import { describe, expect, test } from "vitest";
import { render } from "vitest-browser-svelte";

import {
  useAtomRefresh,
  useAtomResult,
  useAtomSuspense,
} from "../src/index.ts";
import Harness from "./fixtures/harness.svelte";

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
});

describe("useAtomResult", () => {
  test("awaits the first result, then stays live", async () => {
    const registry = AtomRegistry.make();
    const atom = Atom.make(Effect.succeed(1).pipe(Effect.delay("100 millis")));
    const writable = Atom.make(0);
    const derived = Atom.make((get) => get(writable) + 10);
    const screen = await render(Harness, {
      async: true,
      registry,
      setup: async () => {
        // Svelte does not restore component context after an await, so both hooks start before it.
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
