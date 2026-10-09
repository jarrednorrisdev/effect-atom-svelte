import { Cause, Effect, Exit, Stream } from "effect";
import { AsyncResult, Atom, AtomRef, AtomRegistry } from "effect/reactivity";
import { onDestroy, onMount } from "svelte";
import { SvelteMap } from "svelte/reactivity";
import { describe, expect, onTestFinished, test, vi } from "vitest";
import { render } from "vitest-browser-svelte";

import {
  ScopedAtom,
  getRegistry,
  provideRegistry,
  useAtom,
  useAtomInitialValues,
  useAtomMount,
  useAtomRef,
  useAtomRefPropValue,
  useAtomRefresh,
  useAtomSet,
  useAtomSubscribe,
  useAtomValue,
} from "../src/index.ts";
import type { AtomState, ProvideRegistryOptions } from "../src/index.ts";
import DerivedInHandler from "./fixtures/derived-in-handler.svelte";
import EffectTransformReader from "./fixtures/effect-transform-reader.svelte";
import EffectValueReader from "./fixtures/effect-value-reader.svelte";
import Harness from "./fixtures/harness.svelte";
import Provider from "./fixtures/provider.svelte";
import Run from "./fixtures/run.svelte";
import SubscribeIntoState from "./fixtures/subscribe-into-state.svelte";
import ToggleScriptAwait from "./fixtures/toggle-script-await.svelte";
import Toggle from "./fixtures/toggle.svelte";
import { sleep, text } from "./helpers.ts";

const output = (screen: Awaited<ReturnType<typeof render>>) =>
  screen.locator.getByRole("status");

/** A result's value, or its tag while it has none. */
const show = (result: AsyncResult.AsyncResult<string, unknown>) =>
  AsyncResult.isSuccess(result) ? result.value : result._tag;

describe("useAtomValue", () => {
  test("reads a simple atom", async () => {
    const atom = Atom.make(1);
    const screen = await render(Harness, {
      setup: () => {
        const value = useAtomValue(atom);
        return () => value.current;
      },
    });
    await expect.element(output(screen)).toHaveTextContent("1");
  });

  test("applies a transform", async () => {
    const atom = Atom.make(2);
    const screen = await render(Harness, {
      setup: () => {
        const value = useAtomValue(atom, (n) => n * 10);
        return () => value.current;
      },
    });
    await expect.element(output(screen)).toHaveTextContent("20");
  });

  test("keeps a transform's result until the atom changes (JND-25)", async () => {
    const registry = AtomRegistry.make();
    const atom = Atom.make(1);
    const screen = await render(Harness, {
      registry,
      setup: () => {
        const value = useAtomValue(atom, (n) => ({ n }));
        return () => {
          const first = value.current;
          const second = value.current;
          return `${first === second} ${first.n}`;
        };
      },
    });
    await expect.element(output(screen)).toHaveTextContent("true 1");
    registry.set(atom, 2);
    await expect.element(output(screen)).toHaveTextContent("true 2");
  });

  test("runs a transform again when state it reads changes", async () => {
    const atom = Atom.make(2);
    const factor = new SvelteMap([["x", 10]]);
    const screen = await render(Harness, {
      setup: () => {
        const value = useAtomValue(atom, (n) => n * (factor.get("x") ?? 0));
        return () => value.current;
      },
    });
    await expect.element(output(screen)).toHaveTextContent("20");
    factor.set("x", 100);
    await expect.element(output(screen)).toHaveTextContent("200");
  });

  test("a transformed read outside the markup sees the atom's latest value", async () => {
    const registry = AtomRegistry.make();
    const atom = Atom.make(1);
    let value!: { readonly current: number };
    await render(Harness, {
      registry,
      setup: () => {
        value = useAtomValue(atom, (n) => n * 10);
        return () => "";
      },
    });
    expect(value.current).toBe(10);
    registry.set(atom, 2);
    expect(value.current).toBe(20);
  });

  test("a transformed read outside the markup sees a change still waiting to reach the markup", async () => {
    const registry = AtomRegistry.make();
    const watched = Atom.make(0);
    // Its first build writes the watched atom, during the read, so the markup hears it later.
    const read = Atom.make((get) => {
      get.set(watched, 1);
      return "read";
    });
    let readThenTransform: (() => number) | undefined;
    const screen = await render(Harness, {
      registry,
      setup: () => {
        const tens = useAtomValue(watched, (n) => n * 10);
        const value = useAtomValue(read);
        // As an event handler might.
        readThenTransform = () => {
          void value.current;
          return tens.current;
        };
        return () => tens.current;
      },
    });
    await expect.element(output(screen)).toHaveTextContent("0");
    expect(readThenTransform?.()).toBe(10);
    await expect.element(output(screen)).toHaveTextContent("10");
  });

  test("updates when the atom changes outside the component", async () => {
    const registry = AtomRegistry.make();
    const atom = Atom.make(1);
    const screen = await render(Harness, {
      registry,
      setup: () => {
        const value = useAtomValue(atom);
        return () => value.current;
      },
    });
    registry.set(atom, 2);
    await expect.element(output(screen)).toHaveTextContent("2");
  });

  test("works with computed atoms", async () => {
    const registry = AtomRegistry.make();
    const base = Atom.make(3);
    const doubled = Atom.make((get) => get(base) * 2);
    const screen = await render(Harness, {
      registry,
      setup: () => {
        const value = useAtomValue(doubled);
        return () => value.current;
      },
    });
    await expect.element(output(screen)).toHaveTextContent("6");
    registry.set(base, 5);
    await expect.element(output(screen)).toHaveTextContent("10");
  });

  test("follows a getter to a different atom and releases the old one", async () => {
    const registry = AtomRegistry.make();
    const log: string[] = [];
    const tracked = (name: string, value: number) =>
      Atom.make((get) => {
        log.push(`start ${name}`);
        get.addFinalizer(() => log.push(`stop ${name}`));
        return value;
      });
    const first = tracked("first", 1);
    const second = tracked("second", 2);
    const useSecond = Atom.make(false);
    const screen = await render(Harness, {
      registry,
      setup: () => {
        const pick = useAtomValue(useSecond);
        const value = useAtomValue(() => (pick.current ? second : first));
        return () => value.current;
      },
    });
    await expect.element(output(screen)).toHaveTextContent("1");
    registry.set(useSecond, true);
    await expect.element(output(screen)).toHaveTextContent("2");
    await expect
      .poll(() => log)
      .toEqual(["start first", "start second", "stop first"]);
  });

  test("does not throw state_unsafe_mutation when many readers compute the same atom", async () => {
    const registry = AtomRegistry.make();
    const base = Atom.make(1);
    const a = Atom.make((get) => get(base) + 1);
    const b = Atom.make((get) => get(a) * 2);
    const c = Atom.make((get) => `${get(a)}-${get(b)}`);
    const screen = await render(Harness, {
      registry,
      setup: () => {
        const values = [
          useAtomValue(c),
          useAtomValue(b),
          useAtomValue(a),
          useAtomValue(c),
        ];
        return () => values.map((value) => value.current).join(" ");
      },
    });
    await expect.element(output(screen)).toHaveTextContent("2-4 4 2 2-4");
    registry.set(base, 2);
    await expect.element(output(screen)).toHaveTextContent("3-6 6 3 3-6");
  });

  test("uses a shared default registry in the browser when none is provided", async () => {
    const screen = await render(Run, {
      setup: () => {
        const registry = getRegistry();
        return () => registry === getRegistry();
      },
    });
    await expect.element(output(screen)).toHaveTextContent("true");
  });
});

describe("useAtom", () => {
  test("writes through .current", async () => {
    const atom = Atom.make(0);
    let state!: { current: number };
    const screen = await render(Harness, {
      setup: () => {
        state = useAtom(atom);
        return () => state.current;
      },
    });
    state.current += 5;
    await expect.element(output(screen)).toHaveTextContent("5");
  });
});

/** A function for an atom to hold as its value. */
const storedHandler = () => "b";

describe("useAtomSet", () => {
  test("sets a value or applies an updater", async () => {
    const atom = Atom.make(1);
    let set!: (value: number | ((current: number) => number)) => void;
    const screen = await render(Harness, {
      setup: () => {
        const value = useAtomValue(atom);
        set = useAtomSet(atom);
        return () => value.current;
      },
    });
    set(4);
    await expect.element(output(screen)).toHaveTextContent("4");
    set((n) => n + 1);
    await expect.element(output(screen)).toHaveTextContent("5");
  });

  test("promise mode resolves with the result and rejects with the error", async () => {
    const double = Atom.fn((n: number) =>
      n < 0 ? Effect.fail(new Error("negative")) : Effect.succeed(n * 2)
    );
    let run!: (n: number) => Promise<number>;
    await render(Harness, {
      setup: () => {
        run = useAtomSet(double, { mode: "promise" });
        return () => "";
      },
    });
    await expect(run(21)).resolves.toBe(42);
    await expect(run(-1)).rejects.toThrow("negative");
  });

  test("promiseExit mode returns the exit", async () => {
    const fail = Atom.fn(() => Effect.fail("nope" as const));
    let run!: () => Promise<unknown>;
    await render(Harness, {
      setup: () => {
        run = useAtomSet(fail, { mode: "promiseExit" });
        return () => "";
      },
    });
    const exit = await run();
    expect(exit).toMatchObject({ _tag: "Failure" });
  });

  test("an abort signal interrupts the waiting promise", async () => {
    const slow = Atom.fn(() => Effect.never);
    let run!: (
      value: undefined,
      options?: { signal?: AbortSignal }
    ) => Promise<unknown>;
    await render(Harness, {
      setup: () => {
        run = useAtomSet(slow, { mode: "promiseExit" });
        return () => "";
      },
    });
    const controller = new AbortController();
    const exit = run(undefined, { signal: controller.signal });
    controller.abort();
    await expect(exit).resolves.toMatchObject({ _tag: "Failure" });
  });

  describe.each(["promise", "promiseExit"] as const)(
    "an already aborted signal in %s mode",
    (mode) => {
      // An earlier call's settled result must not stand in for the aborted call's.
      test.each([
        { prior: false, state: "Initial" },
        { prior: true, state: "Success" },
      ])(
        "settles as interrupted without writing, with the atom $state (JND-25)",
        async ({ prior, state }) => {
          const registry = AtomRegistry.make();
          let calls = 0;
          const save = Atom.fn((n: number) =>
            Effect.sync(() => {
              calls += 1;
              return n;
            })
          );
          let run!: (
            value: number,
            options?: { signal?: AbortSignal }
          ) => Promise<unknown>;
          await render(Harness, {
            registry,
            setup: () => {
              run =
                mode === "promise"
                  ? useAtomSet(save, { mode: "promise" })
                  : useAtomSet(save, { mode: "promiseExit" });
              return () => "";
            },
          });
          if (prior) {
            await run(1);
          }
          const controller = new AbortController();
          controller.abort();
          const settled = run(2, { signal: controller.signal });
          if (mode === "promiseExit") {
            const exit = (await settled) as Exit.Exit<number>;
            expect(
              Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)
            ).toBe(true);
          } else {
            // The same rejection an abort during the wait gives.
            await expect(settled).rejects.toThrow(
              "All fibers interrupted without error"
            );
          }
          expect(calls).toBe(prior ? 1 : 0);
          expect(registry.get(save)).toMatchObject(
            prior ? { _tag: state, value: 1 } : { _tag: state }
          );
        }
      );
    }
  );

  test("promise modes reject Atom.Reset instead of waiting forever", async () => {
    const registry = AtomRegistry.make();
    const double = Atom.fn((n: number) => Effect.succeed(n * 2));
    let run!: (value: number) => Promise<number>;
    await render(Harness, {
      registry,
      setup: () => {
        run = useAtomSet(double, { mode: "promise" });
        return () => "";
      },
    });
    await expect(run(1)).resolves.toBe(2);
    // Left out of the types: a reset result is Initial, which never settles.
    await expect(run(Atom.Reset as never)).rejects.toThrow("Atom.Reset");
    expect(registry.get(double)).toMatchObject({ _tag: "Success", value: 2 });
  });

  test("value mode stores a function wrapped in an updater", async () => {
    const registry = AtomRegistry.make();
    // Atom.make would take a function as the atom's read, not its value.
    const handler = Atom.writable(
      (): (() => string) => () => "a",
      (ctx, value: () => string) => ctx.setSelf(value)
    );
    let set!: (
      value: (() => string) | ((current: () => string) => () => string)
    ) => void;
    await render(Harness, {
      registry,
      setup: () => {
        set = useAtomSet(handler);
        return () => "";
      },
    });
    set(() => storedHandler);
    expect(registry.get(handler)).toBe(storedHandler);
  });
});

const trackedAtom = (log: string[]) =>
  Atom.make((get) => {
    log.push("start");
    get.addFinalizer(() => log.push("stop"));
    return 1;
  });

/** A family whose atom a getter can return again while what it reads changes. */
const sameAtomSetup = () => {
  const registry = AtomRegistry.make();
  const pick = Atom.make({ id: 1, tag: "x" });
  const watched = Atom.family((_id: number) => Atom.make(0));
  return { pick, registry, watched };
};

describe("mounting and lifecycle", () => {
  test("useAtomMount keeps an atom alive until unmount", async () => {
    const registry = AtomRegistry.make();
    const log: string[] = [];
    const atom = trackedAtom(log);
    const screen = await render(Toggle, {
      registry,
      setup: () => {
        useAtomMount(atom);
        return () => "mounted";
      },
      show: true,
    });
    await expect.poll(() => log).toEqual(["start"]);
    await screen.rerender({ show: false });
    await expect.poll(() => log).toEqual(["start", "stop"]);
  });

  test("a stream atom is disposed when its reader unmounts", async () => {
    const registry = AtomRegistry.make();
    const log: string[] = [];
    const ticks = Atom.make((get) => {
      log.push("start");
      get.addFinalizer(() => log.push("stop"));
      return Stream.tick("10 millis").pipe(
        Stream.scan(
          () => 0,
          (n) => n + 1
        )
      );
    });
    const screen = await render(Toggle, {
      registry,
      setup: () => {
        const value = useAtomValue(ticks);
        return () => value.current._tag;
      },
      show: true,
    });
    await expect.element(output(screen)).toHaveTextContent("Success");
    await screen.rerender({ show: false });
    await expect.poll(() => log).toEqual(["start", "stop"]);
  });

  test("useAtomRefresh recomputes the atom", async () => {
    let computed = 0;
    const atom = Atom.make(() => {
      computed += 1;
      return computed;
    });
    let refresh!: () => void;
    const screen = await render(Harness, {
      setup: () => {
        const value = useAtomValue(atom);
        refresh = useAtomRefresh(atom);
        return () => value.current;
      },
    });
    await expect.element(output(screen)).toHaveTextContent("1");
    refresh();
    await expect.element(output(screen)).toHaveTextContent("2");
  });

  test("useAtomSubscribe with a getter that returns the same atom again doesn't call immediate again", async () => {
    const { pick, registry, watched } = sameAtomSetup();
    const seen: number[] = [];
    await render(Harness, {
      registry,
      setup: () => {
        const choice = useAtomValue(pick);
        useAtomSubscribe(
          () => watched(choice.current.id),
          (value) => seen.push(value),
          { immediate: true }
        );
        return () => choice.current.tag;
      },
    });
    await expect.poll(() => seen).toEqual([0]);
    // Same id, so the getter returns the same atom.
    registry.set(pick, { id: 1, tag: "y" });
    await sleep("30 millis");
    expect(seen).toEqual([0]);
  });

  test("useAtomSubscribe with a getter that returns the same atom again keeps a change waiting for its microtask", async () => {
    const { pick, registry, watched } = sameAtomSetup();
    // Its first build writes the watched atom, during the read, so that change is deferred.
    const read = Atom.make((get) => {
      get.set(watched(1), 1);
      return "read";
    });
    const seen: number[] = [];
    let act!: () => void;
    await render(Harness, {
      registry,
      setup: () => {
        const choice = useAtomValue(pick);
        useAtomSubscribe(
          () => watched(choice.current.id),
          (value) => seen.push(value)
        );
        const value = useAtomValue(read);
        act = () => {
          registry.set(pick, { id: 1, tag: "y" });
          void value.current;
        };
        return () => choice.current.tag;
      },
    });
    act();
    await sleep("30 millis");
    expect(seen).toEqual([1]);
  });

  test("useAtomSubscribe sees every change, and the current value when immediate", async () => {
    const registry = AtomRegistry.make();
    const atom = Atom.make(1);
    const seen: number[] = [];
    await render(Harness, {
      registry,
      setup: () => {
        useAtomSubscribe(atom, (value) => seen.push(value), {
          immediate: true,
        });
        return () => "";
      },
    });
    await expect.poll(() => seen).toEqual([1]);
    registry.set(atom, 2);
    registry.set(atom, 3);
    await expect.poll(() => seen).toEqual([1, 2, 3]);
  });

  test("useAtomSubscribe's immediate call does not track what the callback reads (JND-57)", async () => {
    const registry = AtomRegistry.make();
    const atom = Atom.make(1);
    const other = Atom.make("x");
    const seen: string[] = [];
    await render(Harness, {
      registry,
      setup: () => {
        const label = useAtomValue(other);
        useAtomSubscribe(
          atom,
          (value) => seen.push(`${value}${label.current}`),
          {
            immediate: true,
          }
        );
        return () => label.current;
      },
    });
    await expect.poll(() => seen).toEqual(["1x"]);
    registry.set(other, "y");
    await sleep("50 millis");
    expect(seen).toEqual(["1x"]);
    registry.set(atom, 2);
    await expect.poll(() => seen).toEqual(["1x", "2y"]);
  });

  test("useAtomSubscribe computes a derived atom nothing else reads, and hears its changes", async () => {
    const registry = AtomRegistry.make();
    const base = Atom.make(1);
    const doubled = Atom.make((get) => get(base) * 2);
    const seen: number[] = [];
    await render(Harness, {
      registry,
      setup: () => {
        useAtomSubscribe(doubled, (value) => seen.push(value));
        return () => "";
      },
    });
    registry.set(base, 2);
    registry.set(base, 3);
    await expect.poll(() => seen).toEqual([4, 6]);
  });

  test("useAtomSubscribe runs an effect atom nothing else reads", async () => {
    const registry = AtomRegistry.make();
    const atom = Atom.make(
      Effect.succeed("done").pipe(Effect.delay("20 millis"))
    );
    const seen: string[] = [];
    await render(Harness, {
      registry,
      setup: () => {
        useAtomSubscribe(atom, (value) => seen.push(value._tag));
        return () => "";
      },
    });
    await expect.poll(() => seen).toEqual(["Success"]);
  });

  test("useAtomSubscribe's callback can write $state when a read elsewhere changes the atom", async () => {
    const registry = AtomRegistry.make();
    const watched = Atom.make(0);
    // Reading this atom writes the watched one, while a $derived is evaluating.
    const read = Atom.make((get) => {
      get.set(watched, 1);
      return "read";
    });
    const screen = await render(SubscribeIntoState, {
      read,
      registry,
      show: false,
      watched,
    });
    await expect.element(output(screen)).toHaveTextContent("none hidden");
    await screen.rerender({ show: true });
    await expect.element(output(screen)).toHaveTextContent("1 read");
  });

  test("useAtomSubscribe keeps changes in order when one raised during a read is deferred", async () => {
    const registry = AtomRegistry.make();
    const watched = Atom.make(0);
    // Its first build writes the watched atom, during the read.
    const read = Atom.make((get) => {
      get.set(watched, 1);
      return "read";
    });
    const seen: number[] = [];
    let readThenWrite: (() => void) | undefined;
    await render(Harness, {
      registry,
      setup: () => {
        useAtomSubscribe(watched, (value) => seen.push(value));
        const value = useAtomValue(read);
        // As an event handler might: the read's change is deferred, the write that follows is not.
        readThenWrite = () => {
          void value.current;
          registry.set(watched, 2);
        };
        return () => "";
      },
    });
    readThenWrite?.();
    await sleep("20 millis");
    expect(seen).toEqual([1, 2]);
  });

  test("useAtomSubscribe drops a deferred change once the component is destroyed", async () => {
    const registry = AtomRegistry.make();
    const watched = Atom.make(0);
    const read = Atom.make((get) => {
      get.set(watched, 1);
      return "read";
    });
    const seen: number[] = [];
    let readIt: (() => void) | undefined;
    const screen = await render(Harness, {
      registry,
      setup: () => {
        useAtomSubscribe(watched, (value) => seen.push(value));
        const value = useAtomValue(read);
        readIt = () => {
          void value.current;
        };
        return () => "";
      },
    });
    readIt?.();
    screen.unmount();
    await sleep("20 millis");
    expect(seen).toEqual([]);
  });

  test("useAtomInitialValues applies once per registry", async () => {
    const registry = AtomRegistry.make();
    const atom = Atom.make(0);
    const setup = () => {
      useAtomInitialValues([[atom, 7]]);
      const value = useAtomValue(atom);
      return () => value.current;
    };
    const screen = await render(Harness, { registry, setup });
    await expect.element(output(screen)).toHaveTextContent("7");
    registry.set(atom, 8);
    await render(Harness, { registry, setup });
    expect(registry.get(atom)).toBe(8);
  });

  test("useAtomInitialValues starts a derived atom that still follows its source", async () => {
    const registry = AtomRegistry.make();
    const base = Atom.make(1);
    const doubled = Atom.make((get) => get(base) * 2);
    const screen = await render(Harness, {
      registry,
      setup: () => {
        useAtomInitialValues([[doubled, 100]]);
        const value = useAtomValue(doubled);
        return () => value.current;
      },
    });
    await expect.element(output(screen)).toHaveTextContent("100");
    registry.set(base, 5);
    await expect.element(output(screen)).toHaveTextContent("10");
  });

  test("useAtomInitialValues gives a wrapper's value to its source, as AtomRegistry.make does", async () => {
    const registry = AtomRegistry.make();
    const base = Atom.make(1);
    const wrapped = Atom.withRefresh(base, "1 hour");
    const screen = await render(Harness, {
      registry,
      setup: () => {
        useAtomInitialValues([[wrapped, 100]]);
        const value = useAtomValue(wrapped);
        return () => value.current;
      },
    });
    await expect.element(output(screen)).toHaveTextContent("100");
    expect(registry.get(base)).toBe(100);
    registry.set(base, 5);
    await expect.element(output(screen)).toHaveTextContent("5");
  });

  test("useAtomInitialValues keeps a value until a later component reads it", async () => {
    const registry = AtomRegistry.make();
    const atom = Atom.make(0);
    // A layout sets the value; the page that reads it comes later.
    await render(Harness, {
      registry,
      setup: () => {
        useAtomInitialValues([[atom, 7]]);
        return () => "layout";
      },
    });
    await sleep("50 millis");
    const page = await render(Harness, {
      registry,
      setup: () => {
        const value = useAtomValue(atom);
        return () => value.current;
      },
    });
    await expect.element(output(page)).toHaveTextContent("7");
  });

  test("useAtomInitialValues holds its atoms without computing them, and lets go on unmount", async () => {
    const registry = AtomRegistry.make();
    const log: string[] = [];
    const atom = trackedAtom(log);
    const screen = await render(Toggle, {
      registry,
      setup: () => {
        useAtomInitialValues([[atom, 2]]);
        return () => "";
      },
      show: true,
    });
    await sleep("50 millis");
    expect(log).toEqual([]);
    expect(registry.getNodes().has(atom)).toBe(true);
    await screen.rerender({ show: false });
    await expect.poll(() => registry.getNodes().has(atom)).toBe(false);
    expect(log).toEqual([]);
  });

  test("useAtomInitialValues applies again to a remounted component once its atom was disposed", async () => {
    const registry = AtomRegistry.make();
    const atom = Atom.make(0);
    const screen = await render(Toggle, {
      registry,
      setup: () => {
        useAtomInitialValues([[atom, 7]]);
        const value = useAtomValue(atom);
        return () => value.current;
      },
      show: true,
    });
    await expect.element(output(screen)).toHaveTextContent("7");
    await screen.rerender({ show: false });
    await expect.poll(() => registry.getNodes().has(atom)).toBe(false);
    await screen.rerender({ show: true });
    await expect.element(output(screen)).toHaveTextContent("7");
  });
});

describe("mutations and unmounting", () => {
  test("a mutation in flight still completes after its component unmounts", async () => {
    const registry = AtomRegistry.make();
    const log: string[] = [];
    const save = Atom.fn((value: string) =>
      Effect.sync(() => log.push(`saved ${value}`)).pipe(
        Effect.delay("100 millis"),
        Effect.as(value)
      )
    );
    let run!: (value: string) => Promise<string>;
    const screen = await render(Toggle, {
      registry,
      setup: () => {
        run = useAtomSet(save, { mode: "promise" });
        return () => "";
      },
      show: true,
    });
    const saved = run("draft");
    await screen.rerender({ show: false });
    // The promise holds its own subscription, so leaving the page does not cancel the write.
    await expect(saved).resolves.toBe("draft");
    expect(log).toEqual(["saved draft"]);
  });
});

describe("registries", () => {
  test("separate providers keep separate state", async () => {
    const atom = Atom.make(0);
    const first = AtomRegistry.make();
    const second = AtomRegistry.make();
    const setup = () => {
      const value = useAtomValue(atom);
      return () => value.current;
    };
    const a = await render(Harness, { registry: first, setup });
    const b = await render(Harness, { registry: second, setup });
    first.set(atom, 1);
    await expect.element(output(a)).toHaveTextContent("1");
    await expect.element(output(b)).toHaveTextContent("0");
  });
});

describe("AtomRef", () => {
  test("useAtomRef updates when the ref changes", async () => {
    const ref = AtomRef.make({ count: 0, name: "a" });
    const screen = await render(Harness, {
      setup: () => {
        const value = useAtomRef(ref);
        return () => value.current.count;
      },
    });
    ref.update((current) => ({ ...current, count: 1 }));
    await expect.element(output(screen)).toHaveTextContent("1");
  });

  test("useAtomRef follows a getter to a different ref", async () => {
    const first = AtomRef.make(1);
    const second = AtomRef.make(2);
    const pick = AtomRef.make(false);
    const screen = await render(Harness, {
      setup: () => {
        const useSecond = useAtomRef(pick);
        const value = useAtomRef(() => (useSecond.current ? second : first));
        return () => value.current;
      },
    });
    await expect.element(output(screen)).toHaveTextContent("1");
    pick.set(true);
    await expect.element(output(screen)).toHaveTextContent("2");
    second.set(3);
    await expect.element(output(screen)).toHaveTextContent("3");
  });

  test("useAtomRef hears a ref written while a $derived reads an atom", async () => {
    const registry = AtomRegistry.make();
    const ref = AtomRef.make(0);
    // Reading this atom writes the ref, while the transform's $derived is evaluating.
    const read = Atom.make(() => {
      ref.set(1);
      return "read";
    });
    const screen = await render(Harness, {
      registry,
      setup: () => {
        const value = useAtomRef(ref);
        const shown = useAtomValue(read, (name) => name);
        return () => `${value.current} ${shown.current}`;
      },
    });
    await expect.element(output(screen)).toHaveTextContent("1 read");
  });

  test("useAtomRefPropValue reads one property", async () => {
    const ref = AtomRef.make({ count: 0, name: "a" });
    const screen = await render(Harness, {
      setup: () => {
        const name = useAtomRefPropValue(ref, "name");
        return () => name.current;
      },
    });
    ref.prop("name").set("b");
    await expect.element(output(screen)).toHaveTextContent("b");
  });
});

describe("getter switches (JND-60)", () => {
  test("useAtom reads and writes whichever atom its getter picks", async () => {
    const registry = AtomRegistry.make();
    const first = Atom.make(1);
    const second = Atom.make(10);
    const useSecond = Atom.make(false);
    let cell: AtomState<number> | undefined;
    const screen = await render(Harness, {
      registry,
      setup: () => {
        const pick = useAtomValue(useSecond);
        cell = useAtom(() => (pick.current ? second : first));
        return () => cell?.current;
      },
    });
    await expect.element(output(screen)).toHaveTextContent("1");
    registry.set(useSecond, true);
    await expect.element(output(screen)).toHaveTextContent("10");
    if (cell) {
      cell.current = 11;
    }
    await expect.element(output(screen)).toHaveTextContent("11");
    expect(registry.get(first)).toBe(1);
  });

  test.each([false, true])(
    "a getter switched in onMount computes each atom once, and holds nothing once unmounted (JND-98), async: %s",
    async (async) => {
      const registry = AtomRegistry.make();
      const log: string[] = [];
      const named = Atom.family((name: string) =>
        Atom.make((get) => {
          log.push(`start ${name}`);
          get.addFinalizer(() => log.push(`stop ${name}`));
          return name;
        })
      );
      const screen = await render(Toggle, {
        async,
        registry,
        setup: () => {
          const pick = new SvelteMap([["name", "a"]]);
          onMount(() => {
            pick.set("name", "b");
          });
          const value = useAtomValue(() => named(pick.get("name") ?? "a"));
          return () => value.current;
        },
        show: true,
      });
      await expect.element(output(screen)).toHaveTextContent("b");
      await sleep("50 millis");
      // Renders with the switch rolled back read "a" again, which must not compute it again.
      expect(log.filter((entry) => entry.startsWith("start"))).toEqual([
        "start a",
        "start b",
      ]);
      await screen.rerender({ show: false });
      await expect.poll(() => registry.getNodes().size).toBe(0);
      expect(new Set(log)).toEqual(
        new Set(["start a", "start b", "stop a", "stop b"])
      );
    }
  );

  test("useAtomRefPropValue follows a getter to a different ref", async () => {
    const first = AtomRef.make({ name: "first" });
    const second = AtomRef.make({ name: "second" });
    const pick = AtomRef.make(false);
    const screen = await render(Harness, {
      setup: () => {
        const useSecond = useAtomRef(pick);
        const name = useAtomRefPropValue(
          () => (useSecond.current ? second : first),
          "name"
        );
        return () => name.current;
      },
    });
    await expect.element(output(screen)).toHaveTextContent("first");
    pick.set(true);
    await expect.element(output(screen)).toHaveTextContent("second");
    second.prop("name").set("renamed");
    await expect.element(output(screen)).toHaveTextContent("renamed");
    first.prop("name").set("ignored");
    await sleep("20 millis");
    await expect.element(output(screen)).toHaveTextContent("renamed");
  });
});

describe("a reader's own first build after mount", () => {
  test("a failed first build that a later read recovers reaches the page", async () => {
    const registry = AtomRegistry.make();
    const flag = { ok: false };
    const pick = Atom.make("a");
    const broken = Atom.make(() => {
      if (!flag.ok) {
        throw new Error("broken");
      }
      return "b";
    });
    const atoms = new Map<string, Atom.Atom<string>>([
      ["a", Atom.make("a")],
      ["b", broken],
    ]);
    let cell: { readonly current: string } | undefined;
    const screen = await render(Harness, {
      registry,
      setup: () => {
        const picked = useAtomValue(pick);
        const value = useAtomValue(() => atoms.get(picked.current) ?? broken);
        cell = value;
        return () => {
          try {
            return value.current;
          } catch {
            return "error";
          }
        };
      },
    });
    await expect.element(output(screen)).toHaveTextContent("a");
    // After mount, the getter switches to an atom whose first build throws.
    registry.set(pick, "b");
    await expect.element(output(screen)).toHaveTextContent("error");
    flag.ok = true;
    // An imperative read, as from an event handler, builds the node its failure left uninitialized.
    expect(cell?.current).toBe("b");
    await expect.element(output(screen)).toHaveTextContent("b");
  });

  test("a failed rebuild that a later read recovers reaches the page", async () => {
    const registry = AtomRegistry.make();
    const flag = { n: 1, ok: true };
    const atom = Atom.make(() => {
      if (!flag.ok) {
        throw new Error("broken");
      }
      return flag.n;
    });
    let cell: { readonly current: number } | undefined;
    const screen = await render(Harness, {
      registry,
      setup: () => {
        const value = useAtomValue(atom);
        cell = value;
        return () => value.current;
      },
    });
    await expect.element(output(screen)).toHaveTextContent("1");
    flag.ok = false;
    flag.n = 2;
    expect(() => registry.refresh(atom)).toThrow("broken");
    flag.ok = true;
    // An imperative read, as from an event handler, rebuilds the stale node and announces it.
    expect(cell?.current).toBe(2);
    await expect.element(output(screen)).toHaveTextContent("2");
  });

  test("a getter switch to an atom not built yet runs the transform once for it", async () => {
    const registry = AtomRegistry.make();
    const calls: string[] = [];
    const pick = Atom.make("a");
    const named = Atom.family((name: string) => Atom.make(name));
    const boxes: { readonly name: string }[] = [];
    const screen = await render(Harness, {
      registry,
      setup: () => {
        const picked = useAtomValue(pick);
        const boxed = useAtomValue(
          () => named(picked.current),
          (name) => {
            calls.push(name);
            return { name };
          }
        );
        return () => {
          boxes.push(boxed.current);
          return boxed.current.name;
        };
      },
    });
    await expect.element(output(screen)).toHaveTextContent("a");
    registry.set(pick, "b");
    await expect.element(output(screen)).toHaveTextContent("b");
    await sleep("50 millis");
    expect(calls).toEqual(["a", "b"]);
    expect(new Set(boxes).size).toBe(2);
  });

  test("a transform read only in an $effect runs once while the atom is unchanged", async () => {
    const registry = AtomRegistry.make();
    const seen: unknown[] = [];
    const calls: number[] = [];
    await render(EffectTransformReader, {
      atom: Atom.make(1),
      calls,
      registry,
      seen,
    });
    await expect.poll(() => seen.length).toBeGreaterThan(0);
    await sleep("50 millis");
    expect(calls).toEqual([1]);
    expect(seen).toHaveLength(1);
  });

  test("an $effect that first builds the atom it reads runs once", async () => {
    const registry = AtomRegistry.make();
    const seen: unknown[] = [];
    await render(EffectValueReader, { atom: Atom.make(1), registry, seen });
    await expect.poll(() => seen.length).toBeGreaterThan(0);
    await sleep("50 millis");
    expect(seen).toEqual([1]);
  });

  describe.each([false, true])("a getter switch, async: %s", (async) => {
    /** Renders a reader of `family(name)` whose name a test switches from "a" to "b". */
    const switching = async <A>(
      family: (name: string) => Atom.Atom<A>,
      view: (value: A) => string,
      extra?: () => () => string
    ) => {
      const registry = AtomRegistry.make();
      const pick = Atom.make("a");
      const screen = await render(Harness, {
        async,
        registry,
        setup: () => {
          const picked = useAtomValue(pick);
          const value = useAtomValue(() => family(picked.current));
          const more = extra?.();
          return () => view(value.current) + (more ? `|${more()}` : "");
        },
      });
      return { pick, registry, screen };
    };
    test("a stream's sync emissions in the first build, then an async one, all arrive", async () => {
      const family = Atom.family((name: string) =>
        Atom.make(
          Stream.concat(
            Stream.make(`${name}1`, `${name}2`),
            Stream.fromEffect(
              Effect.sleep("30 millis").pipe(Effect.as(`${name}3`))
            )
          )
        )
      );
      const { pick, registry, screen } = await switching(family, show);
      await expect.poll(text(screen)).toBe("a3");
      registry.set(pick, "b");
      await expect.poll(text(screen)).toBe("b3");
    });

    test("a first build that sets another atom the component reads shows the set value", async () => {
      const other = Atom.make("none");
      const family = Atom.family((name: string) =>
        Atom.make((get) => {
          get.set(other, `set-${name}`);
          return name;
        })
      );
      const { pick, registry, screen } = await switching(
        family,
        (name) => name,
        () => {
          const value = useAtomValue(other);
          return () => value.current;
        }
      );
      await expect.poll(text(screen)).toBe("a|set-a");
      registry.set(pick, "b");
      await expect.poll(text(screen)).toBe("b|set-b");
    });

    test("a first build that sets an atom it read, and so rebuilds, shows the rebuilt value", async () => {
      const family = Atom.family((name: string) => {
        const ticks = Atom.make(0);
        return Atom.make((get) => {
          const tick = get(ticks);
          if (tick === 0) {
            get.set(ticks, 1);
          }
          return `${name}${tick}`;
        });
      });
      const { pick, registry, screen } = await switching(family, (s) => s);
      await expect.poll(text(screen)).toBe("a1");
      registry.set(pick, "b");
      await expect.poll(text(screen)).toBe("b1");
    });

    test("a first build that sets itself at once and later shows the later value", async () => {
      const family = Atom.family((name: string) =>
        Atom.make((get) => {
          get.setSelf(`${name}-sync`);
          const timer = setTimeout(() => get.setSelf(`${name}-late`), 20);
          get.addFinalizer(() => clearTimeout(timer));
          return `${name}-returned`;
        })
      );
      const { pick, registry, screen } = await switching(family, (s) => s);
      await expect.poll(text(screen)).toBe("a-late");
      registry.set(pick, "b");
      await expect.poll(text(screen)).toBe("b-late");
    });

    test("later changes of the switched-to atom still arrive", async () => {
      const family = Atom.family((name: string) => Atom.make(name));
      const { pick, registry, screen } = await switching(family, (s) => s);
      await expect.poll(text(screen)).toBe("a");
      registry.set(pick, "b");
      await expect.poll(text(screen)).toBe("b");
      registry.set(family("b"), "b2");
      await expect.poll(text(screen)).toBe("b2");
      registry.refresh(family("b"));
      registry.set(pick, "a");
      await expect.poll(text(screen)).toBe("a");
    });
  });
});

describe("RegistryProvider", () => {
  test("provides the registry it is given", async () => {
    const registry = AtomRegistry.make();
    const atom = Atom.make(1);
    const screen = await render(Provider, {
      registry,
      setup: () => {
        const value = useAtomValue(atom);
        return () => value.current;
      },
    });
    await expect.element(output(screen)).toHaveTextContent("1");
    registry.set(atom, 2);
    await expect.element(output(screen)).toHaveTextContent("2");
  });

  test("rejects an existing registry together with options for a new one (JND-61)", async () => {
    const atom = Atom.make(1);
    const screen = await render(Harness, {
      setup: () => {
        // A caller without types could pass both; the options would be lost.
        provideRegistry({
          initialValues: [[atom, 5]],
          registry: AtomRegistry.make(),
        } as unknown as ProvideRegistryOptions);
        return () => "unreachable";
      },
    });
    await expect
      .element(output(screen))
      .toHaveTextContent(
        "failed: provideRegistry takes an existing registry or options for a new one, not both. Apply initialValues to the existing registry yourself."
      );
  });

  test("creates a registry from its options and releases its atoms on unmount", async () => {
    const log: string[] = [];
    const atom = Atom.make((get) => {
      get.addFinalizer(() => log.push("disposed"));
      return 1;
    });
    let registry: AtomRegistry.AtomRegistry | undefined;
    const screen = await render(Provider, {
      initialValues: [[atom, 5]],
      setup: () => {
        registry = getRegistry();
        const value = useAtomValue(atom);
        return () => value.current;
      },
    });
    await expect.element(output(screen)).toHaveTextContent("5");
    registry?.refresh(atom);
    await expect.element(output(screen)).toHaveTextContent("1");
    // The refresh disposed the first computation; unmounting disposes the second.
    expect(log).toEqual(["disposed"]);
    await screen.unmount();
    expect(log).toEqual(["disposed", "disposed"]);
  });

  test("disposes its registry only after its children are destroyed", async () => {
    const atom = Atom.make(0).pipe(Atom.keepAlive);
    const written: number[] = [];
    const screen = await render(Provider, {
      setup: () => {
        const set = useAtomSet(atom);
        // A child's own teardown may still write to the provider's registry.
        onDestroy(() => {
          set(5);
          written.push(5);
        });
        return () => "child";
      },
    });
    await expect(screen.unmount()).resolves.toBeUndefined();
    expect(written).toEqual([5]);
  });

  test("reads its props once, and warns in development when one changes", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    onTestFinished(() => warn.mockRestore());
    const atom = Atom.make(1);
    const first = AtomRegistry.make();
    const second = AtomRegistry.make();
    second.set(atom, 2);
    const screen = await render(Provider, {
      registry: first,
      setup: () => {
        const value = useAtomValue(atom);
        return () => value.current;
      },
    });
    await expect.element(output(screen)).toHaveTextContent("1");
    expect(warn).not.toHaveBeenCalled();
    await screen.rerender({ registry: second });
    await expect
      .poll(() => warn.mock.calls.map((call) => String(call[0])))
      .toEqual([expect.stringContaining("reads its props once")]);
    expect(screen.container.textContent).toContain("1");
  });

  test("warns once in development, for a changed revalidateOnHydrate too", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    onTestFinished(() => warn.mockRestore());
    const registry = AtomRegistry.make();
    const props = {
      registry,
      revalidateOnHydrate: false,
      setup: () => () => "shown",
    };
    const screen = await render(Provider, props);
    await expect.element(output(screen)).toHaveTextContent("shown");
    await screen.rerender({ ...props, revalidateOnHydrate: true });
    await expect
      .poll(() => warn.mock.calls.map((call) => String(call[0])))
      .toEqual([expect.stringContaining("reads its props once")]);
    await screen.rerender({ ...props, registry: AtomRegistry.make() });
    await sleep("20 millis");
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("ScopedAtom", () => {
  test("throws when used without a provider", async () => {
    const Scoped = ScopedAtom.make(() => Atom.make(0));
    const screen = await render(Harness, {
      setup: () => {
        Scoped.use();
        return () => "unreachable";
      },
    });
    await expect
      .poll(() => screen.container.textContent)
      .toContain("failed: ScopedAtom used outside");
  });

  test("names itself in the error when given a name", async () => {
    const Counter = ScopedAtom.make(() => Atom.make(0), { name: "Counter" });
    const screen = await render(Harness, {
      setup: () => {
        Counter.use();
        return () => "unreachable";
      },
    });
    await expect
      .poll(() => screen.container.textContent)
      .toContain(
        `failed: ScopedAtom "Counter" used outside of the component that provides it. Call Counter.provide() in a parent component's script.`
      );
  });

  test("provides one atom per provider, built from its input", async () => {
    const Scoped = ScopedAtom.make((start: number) => Atom.make(start));
    const setup = (start: number) => () => {
      const atom = Scoped.provide(start);
      const value = useAtomValue(Scoped.use());
      return () => `${value.current} ${atom === Scoped.use()}`;
    };
    const a = await render(Harness, { setup: setup(1) });
    const b = await render(Harness, { setup: setup(2) });
    await expect.element(output(a)).toHaveTextContent("1 true");
    await expect.element(output(b)).toHaveTextContent("2 true");
  });

  test("provides without an input when the factory's input is optional", async () => {
    const Scoped = ScopedAtom.make((start?: number) => Atom.make(start ?? 7));
    const screen = await render(Harness, {
      setup: () => {
        Scoped.provide();
        const value = useAtomValue(Scoped.use());
        return () => value.current;
      },
    });
    await expect.element(output(screen)).toHaveTextContent("7");
  });
});

/** Wraps a ref to count its live subscriptions. */
const countSubscriptions = <A>(ref: AtomRef.ReadonlyRef<A>) => {
  const counter = { active: 0, total: 0 };
  const counted: AtomRef.ReadonlyRef<A> = Object.create(ref, {
    subscribe: {
      value: (f: (a: A) => void) => {
        counter.active += 1;
        counter.total += 1;
        const unsubscribe = ref.subscribe(f);
        return () => {
          counter.active -= 1;
          unsubscribe();
        };
      },
    },
  });
  return { counted, counter };
};

const asRef = (ref: AtomRef.ReadonlyRef<{ name: string }>) =>
  ref as AtomRef.AtomRef<{ name: string }>;

describe("regressions from a review of the hooks", () => {
  test("one holder letting go does not release another holder's hold", async () => {
    const registry = AtomRegistry.make();
    const atom = Atom.make(0);
    // A layout seeds the atom and stays mounted.
    await render(Harness, {
      registry,
      setup: () => {
        useAtomInitialValues([[atom, 7]]);
        return () => "layout";
      },
    });
    // A page seeds the same atom, then the user navigates away.
    const page = await render(Toggle, {
      registry,
      setup: () => {
        useAtomInitialValues([[atom, 7]]);
        return () => "page";
      },
      show: true,
    });
    await page.rerender({ show: false });
    await sleep("50 millis");
    // The layout still holds it, so it must keep its value.
    expect(registry.getNodes().has(atom)).toBe(true);
    const reader = await render(Harness, {
      registry,
      setup: () => {
        const value = useAtomValue(atom);
        return () => value.current;
      },
    });
    await expect.element(output(reader)).toHaveTextContent("7");
  });

  test("useAtomInitialValues sets an atom another component already reads, as atom-react does", async () => {
    const registry = AtomRegistry.make();
    const atom = Atom.make(0);
    const reader = await render(Harness, {
      registry,
      setup: () => {
        const value = useAtomValue(atom);
        return () => value.current;
      },
    });
    registry.set(atom, 5);
    await expect.element(output(reader)).toHaveTextContent("5");
    await render(Harness, {
      registry,
      setup: () => {
        useAtomInitialValues([[atom, 7]]);
        return () => "later";
      },
    });
    await expect.element(output(reader)).toHaveTextContent("7");
  });

  test("a getter switch whose subscribe throws still follows the new atom afterwards", async () => {
    const registry = AtomRegistry.make();
    const src = Atom.make(0);
    // Throws while src is odd.
    const bad = Atom.make((get) => {
      const n = get(src);
      if (n % 2 === 1) {
        throw new Error("odd");
      }
      return n;
    });
    const good = Atom.make(-1);
    const pick = Atom.make(false);
    // Built once, then left stale and unobserved by the write below.
    registry.get(bad);
    let readInHandler!: () => void;
    const screen = await render(Harness, {
      registry,
      setup: () => {
        const useBad = useAtomValue(pick);
        const value = useAtomValue(() => (useBad.current ? bad : good));
        readInHandler = () => {
          registry.set(src, 1);
          registry.set(pick, true);
          try {
            void value.current;
          } catch {
            // as a handler that tolerates the failure would
          }
          registry.set(src, 2);
        };
        return () => value.current;
      },
    });
    await expect.element(output(screen)).toHaveTextContent("-1");
    readInHandler();
    await expect.element(output(screen)).toHaveTextContent("2");
    registry.set(src, 4);
    await expect.element(output(screen)).toHaveTextContent("4");
  });

  test("a $derived read only in an event handler sees the atom's latest value", async () => {
    const registry = AtomRegistry.make();
    const atom = Atom.make(1);
    const screen = await render(DerivedInHandler, { atom, registry });
    await screen.getByRole("button").click();
    await expect.element(output(screen)).toHaveTextContent("1 10");
    registry.set(atom, 2);
    await screen.getByRole("button").click();
    await expect.element(output(screen)).toHaveTextContent("2 20");
  });

  test("useAtomRef lets go of the old ref when its getter switches", async () => {
    const first = countSubscriptions(AtomRef.make(1));
    const second = countSubscriptions(AtomRef.make(2));
    const pick = AtomRef.make(false);
    const screen = await render(Harness, {
      setup: () => {
        const useSecond = useAtomRef(pick);
        const value = useAtomRef(() =>
          useSecond.current ? second.counted : first.counted
        );
        return () => value.current;
      },
    });
    await expect.element(output(screen)).toHaveTextContent("1");
    pick.set(true);
    await expect.element(output(screen)).toHaveTextContent("2");
    await sleep("20 millis");
    expect(first.counter.active).toBe(0);
    expect(second.counter.active).toBe(1);
  });

  test("useAtomRefPropValue lets go of the old parent when its getter switches", async () => {
    const first = countSubscriptions(AtomRef.make({ name: "first" }));
    const second = countSubscriptions(AtomRef.make({ name: "second" }));
    const pick = AtomRef.make(false);
    const screen = await render(Harness, {
      setup: () => {
        const useSecond = useAtomRef(pick);
        const name = useAtomRefPropValue(
          () => asRef(useSecond.current ? second.counted : first.counted),
          "name"
        );
        return () => name.current;
      },
    });
    await expect.element(output(screen)).toHaveTextContent("first");
    pick.set(true);
    await expect.element(output(screen)).toHaveTextContent("second");
    await sleep("20 millis");
    expect(first.counter.active).toBe(0);
    expect(second.counter.active).toBe(1);
  });

  test.each([
    { pending: false, title: "once mounted (control)" },
    { pending: true, title: "while its script awaits" },
  ])(
    "a component that provides a registry disposes of it when destroyed $title",
    async ({ pending }) => {
      const log: string[] = [];
      const resource = Atom.make((get) => {
        get.addFinalizer(() => log.push("released"));
        return 1;
      }).pipe(Atom.keepAlive);
      const screen = await render(ToggleScriptAwait, {
        registry: AtomRegistry.make(),
        setup: () => {
          const own = provideRegistry();
          own.get(resource);
          return pending
            ? Effect.runPromise(Effect.never)
            : Promise.resolve("ok");
        },
        show: true,
      });
      await sleep("20 millis");
      await screen.rerender({ show: false });
      await expect.poll(() => log, { timeout: 500 }).toEqual(["released"]);
    }
  );
});
