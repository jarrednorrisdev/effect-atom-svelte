import { Effect, Option, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";
import { onDestroy } from "svelte";
import { describe, expect, onTestFinished, test, vi } from "vitest";
import { render } from "vitest-browser-svelte";

import {
  useAtomRefresh,
  useAtomResult,
  useAtomSuspense,
  useAtomValue,
} from "../src/index.ts";
import type { AtomValue } from "../src/index.ts";
import CityWeather from "./fixtures/city-weather.svelte";
import Harness from "./fixtures/harness.svelte";
import SequentialAwaits from "./fixtures/sequential-awaits.svelte";
import StateGetter from "./fixtures/state-getter.svelte";
import SuspenseInEffect from "./fixtures/suspense-in-effect.svelte";
import SuspenseToggle from "./fixtures/suspense-toggle.svelte";
import SuspenseUnreadDerived from "./fixtures/suspense-unread-derived-toggle.svelte";
import ToggleScriptAwait from "./fixtures/toggle-script-await.svelte";
import Toggle from "./fixtures/toggle.svelte";
import { repeat, sleep } from "./helpers.ts";

const text = (screen: Awaited<ReturnType<typeof render>>) => () =>
  screen.container.textContent?.trim();

const delayed = <A>(value: A, millis = 50) =>
  Atom.make(Effect.succeed(value).pipe(Effect.delay(`${millis} millis`)));

/** An async atom whose value counts how often it has run. */
const counter = () => {
  let calls = 0;
  return Atom.make(
    Effect.sync(() => {
      calls += 1;
      return calls;
    }).pipe(Effect.delay("50 millis"))
  );
};

const slowMillis = 100;
/** Long enough for a slow atom's request to have finished, had it not been interrupted. */
const afterSlowRequest = `${slowMillis + 50} millis` as const;

/** Slow atoms that log when they start, finish their request and are disposed. */
const slowFamily = (log: string[]) =>
  Atom.family((name: string) =>
    Atom.make((get) => {
      log.push(`start ${name}`);
      get.addFinalizer(() => log.push(`stop ${name}`));
      return Effect.sync(() => {
        log.push(`done ${name}`);
        return name;
      }).pipe(Effect.delay(`${slowMillis} millis`));
    })
  );

/** `slowFamily`, with each atom serializable, as `AtomRpc` and `AtomHttpApi` queries are. */
const slowSerializableFamily = (log: string[]) => {
  const slow = slowFamily(log);
  return Atom.family((name: string) =>
    slow(name).pipe(
      Atom.serializable({
        key: `slow-${name}`,
        schema: AsyncResult.Schema({ success: Schema.String }),
      })
    )
  );
};

/** Unmounts while slow atom "a" is loading, and checks it is disposed without finishing. */
const expectUnmountInterrupts = async (
  log: string[],
  unmount: () => Promise<unknown>
) => {
  await expect.poll(() => log).toEqual(["start a"]);
  await unmount();
  await expect.poll(() => log).toEqual(["start a", "stop a"]);
  await sleep(afterSlowRequest);
  expect(log).toEqual(["start a", "stop a"]);
};

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

  test("a synchronously resolving atom awaited in an $effect runs the code after the await once", async () => {
    const registry = AtomRegistry.make();
    const seen: unknown[] = [];
    await render(SuspenseInEffect, {
      atom: Atom.make(Effect.succeed(7)),
      registry,
      seen,
    });
    await expect.poll(() => seen.length).toBeGreaterThan(0);
    await sleep("50 millis");
    expect(seen).toEqual([7]);
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

  // A Failure after a success keeps it as previousSuccess; a result rebuilt from the Exit would not.
  test("includeFailure resolves with the atom's own result after waiting for it", async () => {
    let runs = 0;
    const atom = Atom.make(
      Effect.suspend(() =>
        (runs += 1) === 1 ? Effect.succeed(1) : Effect.fail("nope" as const)
      ).pipe(Effect.delay("20 millis"))
    );
    const registry = AtomRegistry.make();
    onTestFinished(() => registry.dispose());
    const release = registry.mount(atom);
    onTestFinished(release);
    await expect.poll(() => registry.get(atom)._tag).toBe("Success");
    let value:
      | AtomValue<
          Promise<
            | AsyncResult.Success<number, "nope">
            | AsyncResult.Failure<number, "nope">
          >
        >
      | undefined;
    await render(Harness, {
      registry,
      setup: () => {
        value = useAtomSuspense(atom, {
          includeFailure: true,
          suspendOnWaiting: true,
        });
        return () => "";
      },
    });
    registry.refresh(atom);
    const resolved = await value?.current;
    expect(resolved).toBe(registry.get(atom));
    expect(
      resolved?._tag === "Failure" && Option.isSome(resolved.previousSuccess)
    ).toBe(true);
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
    // A render with the switch rolled back still reads "a", which must not compute it again (JND-35).
    expect(computed).toEqual(["a", "b", "b"]);
    // Kept only until the switch commits, and nothing outlives the component.
    await expect.poll(() => registry.getNodes().has(named("a"))).toBe(false);
    await screen.unmount();
    await expect.poll(() => registry.getNodes().size).toBe(0);
  });

  test("a getter switch while pending interrupts the abandoned atoms (JND-16)", async () => {
    const registry = AtomRegistry.make();
    const pick = Atom.make("a");
    const log: string[] = [];
    const slow = slowFamily(log);
    const screen = await render(Harness, {
      async: true,
      registry,
      setup: () => {
        const choice = useAtomValue(pick);
        const value = useAtomSuspense(() => slow(choice.current));
        return () => value.current;
      },
    });
    await expect.poll(() => log).toContain("start a");
    registry.set(pick, "b");
    await expect.poll(() => log).toContain("start b");
    registry.set(pick, "c");
    await expect.poll(text(screen)).toBe("c");
    await sleep(afterSlowRequest);
    expect(log.filter((entry) => entry.startsWith("done"))).toEqual(["done c"]);
    expect(log).toContain("stop a");
    expect(log).toContain("stop b");
    expect(registry.getNodes().has(slow("a"))).toBe(false);
    expect(registry.getNodes().has(slow("b"))).toBe(false);
  });

  test("a getter switch while a serializable atom's first load is pending interrupts it", async () => {
    const registry = AtomRegistry.make();
    const pick = Atom.make("a");
    const log: string[] = [];
    const slow = slowSerializableFamily(log);
    const screen = await render(Harness, {
      async: true,
      registry,
      setup: () => {
        const choice = useAtomValue(pick);
        const value = useAtomSuspense(() => slow(choice.current));
        return () => value.current;
      },
    });
    await expect.poll(() => log).toContain("start a");
    // Neither the component nor the seed holds the first atom: only the render reading it does.
    registry.set(pick, "b");
    await expect.poll(text(screen)).toBe("b");
    await sleep(afterSlowRequest);
    expect(log.filter((entry) => entry.startsWith("done"))).toEqual(["done b"]);
    expect(log).toContain("stop a");
    expect(registry.getNodes().has(slow("a"))).toBe(false);
  });

  test("atoms that share a pending result each get their own wait", async () => {
    const source = delayed("a", 30);
    // Returns its source's result object until it succeeds, so both are pending with one object.
    const shout = Atom.make((get) => {
      const result = get(source);
      return AsyncResult.isSuccess(result)
        ? AsyncResult.success(result.value.toUpperCase())
        : result;
    });
    let which: typeof source = source;
    let fromSource!: Promise<unknown>;
    let fromShout!: Promise<unknown>;
    await render(Harness, {
      setup: () => {
        const value = useAtomSuspense(() => which);
        fromSource = value.current;
        which = shout;
        fromShout = value.current;
        return () => "";
      },
    });
    await expect(fromSource).resolves.toBe("a");
    await expect(fromShout).resolves.toBe("A");
  });

  test("a switch away from a pending atom after the first value does not reach the boundary (JND-22)", async () => {
    const registry = AtomRegistry.make();
    const pick = Atom.make("a");
    const log: string[] = [];
    const slow = slowFamily(log);
    const screen = await render(Harness, {
      async: true,
      registry,
      setup: () => {
        const choice = useAtomValue(pick);
        const value = useAtomSuspense(() => slow(choice.current));
        return () => value.current;
      },
    });
    await expect.poll(text(screen)).toBe("a");
    registry.set(pick, "b");
    await expect.poll(() => log).toContain("start b");
    // The render that switched to "b" still awaits b's wait, which this switch abandons.
    registry.set(pick, "c");
    await expect.poll(text(screen)).toBe("c");
    await expect.poll(() => log).toContain("stop a");
    expect(log.filter((entry) => entry.startsWith("done"))).toEqual([
      "done a",
      "done c",
    ]);
    expect(log).toContain("stop b");
  });

  test("unmounting while pending interrupts the wait (JND-16)", async () => {
    const registry = AtomRegistry.make();
    const log: string[] = [];
    const slow = slowFamily(log);
    const screen = await render(Toggle, {
      async: true,
      registry,
      setup: () => {
        const value = useAtomSuspense(slow("a"));
        return () => value.current;
      },
      show: true,
    });
    await expectUnmountInterrupts(log, () => screen.rerender({ show: false }));
  });

  test("a promise awaited in the script lets go of its atom on unmount (JND-16)", async () => {
    const registry = AtomRegistry.make();
    const log: string[] = [];
    const slow = slowFamily(log);
    const screen = await render(ToggleScriptAwait, {
      registry,
      setup: async () => {
        const value = useAtomSuspense(slow("a"));
        return await value.current;
      },
      show: true,
    });
    await expectUnmountInterrupts(log, () => screen.rerender({ show: false }));
  });

  test("a serializable atom awaited in the script is interrupted on unmount (JND-57)", async () => {
    const registry = AtomRegistry.make();
    const log: string[] = [];
    const slow = slowSerializableFamily(log);
    const screen = await render(ToggleScriptAwait, {
      registry,
      setup: async () => {
        const value = useAtomSuspense(slow("a"));
        return await value.current;
      },
      show: true,
    });
    await expectUnmountInterrupts(log, () => screen.rerender({ show: false }));
  });

  test("a settled promise is reused after its readers go away", async () => {
    const registry = AtomRegistry.make();
    const promises: Promise<unknown>[] = [];
    const atom = delayed("a", 20);
    // Kept mounted, so the result stays the same object while nothing shows it.
    registry.mount(atom);
    const screen = await render(SuspenseToggle, {
      atom,
      promises,
      registry,
    });
    await expect.poll(text(screen)).toBe("toggle a");
    const shown = promises.at(-1);
    const button = screen.container.querySelector("button");
    button?.click();
    await expect.poll(text(screen)).toBe("toggle");
    await sleep("20 millis");
    button?.click();
    await expect.poll(text(screen)).toBe("toggle a");
    expect(promises.at(-1)).toBe(shown);
  });

  test("a reader that re-runs while the result is pending keeps its promise", async () => {
    const registry = AtomRegistry.make();
    const atom = delayed("a", 200);
    const other = Atom.make(0);
    // The promises read while the result was still pending.
    const pending: Promise<string>[] = [];
    const screen = await render(Harness, {
      async: true,
      registry,
      setup: () => {
        const count = useAtomValue(other);
        const value = useAtomSuspense(atom);
        return () => {
          const n = count.current;
          const promise = value.current;
          if (registry.get(atom)._tag === "Initial") {
            pending.push(promise);
          }
          return promise.then((v) => `${v} ${n}`);
        };
      },
    });
    await expect.poll(() => pending.length).toBe(1);
    // The reaction aborts its signal and re-runs; the re-run must hold the same wait.
    registry.set(other, 1);
    await expect.poll(text(screen)).toBe("a 1");
    expect(pending).toHaveLength(2);
    expect(pending[1]).toBe(pending[0]);
  });

  test("a pending result read again after its readers went away gets a new wait", async () => {
    const registry = AtomRegistry.make();
    const atom = delayed("a", 200);
    // Kept mounted, so the pending result stays the same object while nothing shows it.
    registry.mount(atom);
    const show = Atom.make(true);
    let read!: () => Promise<string>;
    const screen = await render(Harness, {
      async: true,
      registry,
      setup: () => {
        const shown = useAtomValue(show);
        const value = useAtomSuspense(atom);
        read = () => value.current;
        return () => (shown.current ? value.current : "hidden");
      },
    });
    await expect.poll(text(screen)).toBe("pending");
    registry.set(show, false);
    await expect.poll(text(screen)).toBe("hidden");
    await sleep("20 millis");
    // The first wait was interrupted when its reader went away; these reads must not reuse it.
    const handlerRead = read();
    registry.set(show, true);
    await expect(handlerRead).resolves.toBe("a");
    await expect.poll(text(screen)).toBe("a");
  });

  test("suspendOnWaiting makes a refresh's promise wait for the new value (JND-57)", async () => {
    const registry = AtomRegistry.make();
    const atom = counter();
    let plain!: AtomValue<Promise<number>>;
    let waiting!: AtomValue<Promise<number>>;
    const screen = await render(Harness, {
      async: true,
      registry,
      setup: () => {
        plain = useAtomSuspense(atom);
        waiting = useAtomSuspense(atom, { suspendOnWaiting: true });
        return () => waiting.current;
      },
    });
    await expect.poll(text(screen)).toBe("1");
    registry.refresh(atom);
    expect(await Promise.all([plain.current, waiting.current])).toEqual([1, 2]);
    await expect.poll(text(screen)).toBe("2");
  });

  test("refreshes after an abandoned getter switch reach the boundary, failures included (JND-93)", async () => {
    const registry = AtomRegistry.make();
    let failNext = false;
    const loads: Record<string, number> = {};
    const weather = Atom.family((city: string) =>
      Atom.make(
        Effect.gen(function* load() {
          yield* Effect.sleep("100 millis");
          if (failNext) {
            failNext = false;
            return yield* Effect.fail(new Error(`no weather for ${city}`));
          }
          loads[city] = (loads[city] ?? 0) + 1;
          return `${city.toLowerCase()}${loads[city]}`;
        })
      )
    );
    const screen = await render(CityWeather, { registry, weather });
    const click = (label: string) =>
      [...screen.container.querySelectorAll("button")]
        .find((button) => button.textContent === label)
        ?.click();
    const shown = () => screen.container.querySelector("output")?.textContent;
    await expect.poll(shown).toBe("Paris: paris1");
    click("Tokyo");
    await expect.poll(shown).toBe("Tokyo: tokyo1");
    // Lima's load is abandoned and interrupted.
    click("Lima");
    await sleep("20 millis");
    click("Paris");
    await expect.poll(shown).toBe("Paris: paris2");
    // A render with both switches rolled back reads Tokyo after the render that picks Paris; the
    // hook must still follow Paris, or neither refresh below reaches the page.
    click("Reload");
    await expect.poll(shown).toBe("Paris: paris3");
    failNext = true;
    click("Reload");
    await expect.poll(shown).toBe("failed: no weather for Paris");
  });
});

describe("useAtomSuspense read outside the markup", () => {
  // Svelte aborts a derived's signal when it runs again or loses its last reader, and doesn't
  // destroy deriveds with their component, so a derived only the script or a handler reads never
  // aborts it. A read after the component is destroyed gets its already aborted lifetime.
  test.each(["script", "handler", "destroy"] as const)(
    "a read in the %s doesn't hold a pending atom once the component is destroyed",
    async (mode) => {
      const registry = AtomRegistry.make();
      onTestFinished(() => registry.dispose());
      const log: string[] = [];
      const atom = Atom.make((get) => {
        log.push("start");
        get.addFinalizer(() => log.push("stop"));
        return Effect.never;
      });
      const screen = await render(SuspenseUnreadDerived, {
        atom,
        mode,
        registry,
        show: true,
      });
      if (mode === "handler") {
        await screen.getByRole("button").click();
      }
      if (mode !== "destroy") {
        await expect.poll(() => log).toEqual(["start"]);
      }
      await screen.rerender({ show: false });
      // Read once it is destroyed, the atom isn't started at all.
      const after = mode === "destroy" ? [] : ["start", "stop"];
      await expect.poll(() => log).toEqual(after);
      await sleep("100 millis");
      expect(log).toEqual(after);
    }
  );

  test("a read after the component is destroyed still gets a result it had settled", async () => {
    const registry = AtomRegistry.make();
    onTestFinished(() => registry.dispose());
    const atom = Atom.make(Effect.succeed("x").pipe(Effect.delay("20 millis")));
    let late: Promise<unknown> | undefined;
    const screen = await render(Toggle, {
      async: true,
      registry,
      setup: () => {
        const value = useAtomSuspense(atom);
        onDestroy(() => {
          late = value.current;
        });
        return () => value.current;
      },
      show: true,
    });
    await expect.poll(text(screen)).toBe("x");
    await screen.rerender({ show: false });
    await expect(late).resolves.toBe("x");
  });
});

describe("useAtomResult", () => {
  test("suspendOnWaiting makes the first await wait for a refresh in progress (JND-57)", async () => {
    const registry = AtomRegistry.make();
    const atom = counter();
    const release = registry.mount(atom);
    const current = () => {
      const result = registry.get(atom);
      if (result._tag !== "Success") {
        return result._tag;
      }
      return result.waiting ? `${result.value} waiting` : String(result.value);
    };
    await expect.poll(current).toBe("1");
    registry.refresh(atom);
    expect(current()).toBe("1 waiting");
    const show = (suspendOnWaiting: boolean) =>
      render(ToggleScriptAwait, {
        registry,
        setup: async () => {
          const result = await useAtomResult(atom, { suspendOnWaiting });
          const { current: first } = result;
          return first._tag === "Success" ? first.value : first._tag;
        },
        show: true,
      });
    const [plain, waiting] = await Promise.all([show(false), show(true)]);
    await expect.poll(text(plain)).toBe("1");
    await expect.poll(text(waiting)).toBe("2");
    release();
  });

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

  test("a getter follows the new atom without re-running the top-level await", async () => {
    const registry = AtomRegistry.make();
    const pick = Atom.make("a");
    const named = Atom.family((name: string) => delayed(name, 100));
    let setups = 0;
    const screen = await render(Harness, {
      async: true,
      registry,
      setup: async () => {
        setups += 1;
        const choice = useAtomValue(pick);
        const result = await useAtomResult(() => named(choice.current));
        return () =>
          result.current._tag === "Success"
            ? result.current.value
            : result.current._tag;
      },
    });
    await expect.poll(text(screen)).toBe("a");
    registry.set(pick, "b");
    await expect.poll(text(screen)).toBe("Initial");
    await expect.poll(text(screen)).toBe("b");
    expect(setups).toBe(1);
    // The handle keeps "b" mounted; "a" is released once nothing reads it.
    await sleep("50 millis");
    expect(registry.getNodes().has(named("b"))).toBe(true);
    expect(registry.getNodes().has(named("a"))).toBe(false);
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

  test("a promise not awaited at once lets go of a serializable first atom the getter left while seeding", async () => {
    const registry = AtomRegistry.make();
    const log: string[] = [];
    const slow = slowSerializableFamily(log);
    let which = "a";
    await render(Harness, {
      registry,
      setup: () => {
        void useAtomResult(() => slow(which));
        // Switched before the component mounts, so its effect holds "b" before the seed is in.
        which = "b";
        return () => "";
      },
    });
    await expect.poll(() => log).toContain("done b");
    await sleep(afterSlowRequest);
    expect(log).not.toContain("start a");
    expect(registry.getNodes().has(slow("a"))).toBe(false);
  });

  test("unmounting before the first result interrupts the wait (JND-16)", async () => {
    const registry = AtomRegistry.make();
    const log: string[] = [];
    const slow = slowFamily(log);
    const screen = await render(ToggleScriptAwait, {
      registry,
      setup: async () => {
        const result = await useAtomResult(slow("a"));
        return result.current._tag;
      },
      show: true,
    });
    await expectUnmountInterrupts(log, () => screen.rerender({ show: false }));
  });

  test("unmounting before a serializable atom's first result interrupts it (JND-57)", async () => {
    const registry = AtomRegistry.make();
    const log: string[] = [];
    const slow = slowSerializableFamily(log);
    const screen = await render(ToggleScriptAwait, {
      registry,
      setup: async () => {
        const result = await useAtomResult(slow("a"));
        return result.current._tag;
      },
      show: true,
    });
    await expectUnmountInterrupts(log, () => screen.rerender({ show: false }));
  });
});

/** A serializable async atom; a new object on every call, as when a component creates it. */
const keyed = (key: string, value: string) =>
  Atom.make(Effect.succeed(value)).pipe(
    Atom.serializable({
      key,
      schema: AsyncResult.Schema({ success: Schema.String }),
    })
  );

describe("serialization keys in the browser (JND-60)", () => {
  test("an atom created per mount can reuse its key once the last one is gone", async () => {
    const registry = AtomRegistry.make();
    let mounts = 0;
    const screen = await render(Toggle, {
      async: true,
      registry,
      setup: () => {
        mounts += 1;
        const value = useAtomSuspense(keyed("per-mount", `mount ${mounts}`));
        return () => value.current;
      },
      show: true,
    });
    await expect.poll(text(screen)).toBe("mount 1");
    await repeat(2, async () => {
      await screen.rerender({ show: false });
      await expect.poll(text(screen)).toBe("");
      // The registry keys a serializable atom's node by its key, so wait for the old one to go.
      await expect.poll(() => registry.getNodes().size).toBe(0);
      await screen.rerender({ show: true });
      // Each mount computes its own atom: nothing seeds it with an earlier one's value.
      await expect.poll(text(screen)).toBe(`mount ${mounts}`);
    });
    expect(mounts).toBe(3);
  });

  test("two different atoms in use at once with one key share its value, without an error or a warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    onTestFinished(() => warn.mockRestore());
    const screen = await render(Harness, {
      async: true,
      registry: AtomRegistry.make(),
      setup: () => {
        const first = useAtomSuspense(keyed("dup", "first"));
        const second = useAtomSuspense(keyed("dup", "second"));
        // The registry keys a serializable atom's node by its key, so both read the first's node.
        return async () => `${await first.current} ${await second.current}`;
      },
    });
    await expect.poll(text(screen)).toBe("first first");
    // Only the server render throws for this: in the browser a remount, as under {#key}, briefly
    // has an old and a new atom holding one key.
    expect(warn).not.toHaveBeenCalled();
  });
});
