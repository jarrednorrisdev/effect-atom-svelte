import { Effect, Stream } from "effect";
import { Atom, AtomRef, AtomRegistry } from "effect/reactivity";
import { describe, expect, test } from "vitest";
import { render } from "vitest-browser-svelte";

import {
  ScopedAtom,
  getRegistry,
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
import Harness from "./fixtures/harness.svelte";
import Run from "./fixtures/run.svelte";
import Toggle from "./fixtures/toggle.svelte";

const output = (screen: Awaited<ReturnType<typeof render>>) =>
  screen.locator.getByRole("status");

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
});

const trackedAtom = (log: string[]) =>
  Atom.make((get) => {
    log.push("start");
    get.addFinalizer(() => log.push("stop"));
    return 1;
  });

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
});
