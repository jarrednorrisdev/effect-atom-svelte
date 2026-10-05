import { Effect, Stream } from "effect";
import { Atom, AtomRef, AtomRegistry } from "effect/reactivity";
import { describe, expect, test } from "vitest";
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
import Harness from "./fixtures/harness.svelte";
import Provider from "./fixtures/provider.svelte";
import Run from "./fixtures/run.svelte";
import SubscribeIntoState from "./fixtures/subscribe-into-state.svelte";
import Toggle from "./fixtures/toggle.svelte";
import { sleep } from "./helpers.ts";

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

  test("useAtomInitialValues lets go of its atoms on unmount", async () => {
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
    await expect.poll(() => log).toEqual(["start"]);
    await screen.rerender({ show: false });
    await expect.poll(() => log).toEqual(["start", "stop"]);
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
