import { Effect, Schema } from "effect";
import { AsyncResult, Atom, AtomRef, AtomRegistry } from "effect/reactivity";
import { describe, expect, test } from "vitest";
import { render } from "vitest-browser-svelte";

import {
  useAtomRef,
  useAtomResult,
  useAtomSet,
  useAtomSuspense,
  useAtomValue,
} from "../src/index.ts";
import ToggleScriptAwait from "./fixtures/toggle-script-await.svelte";
import Toggle from "./fixtures/toggle.svelte";
import { repeat, text, tracked } from "./helpers.ts";

const cycles = 10;

/** What every cycle should log: each mount computes the atom once, and each unmount disposes it. */
const startStop = (times: number) =>
  Array.from({ length: times }).flatMap(() => ["start", "stop"]);

interface Cycle {
  readonly registry: AtomRegistry.AtomRegistry;
  readonly setup: () => unknown;
  /** The text the component shows once mounted, so a cycle only unmounts a fully rendered component. */
  readonly shows: string;
  readonly async?: boolean;
}

/**
 * Mounts and unmounts a component `cycles` times. After each unmount the registry must go back to the
 * nodes it had before the first mount, so the next mount cannot reuse anything a leak kept alive.
 */
const mountCycles = async ({
  async = false,
  registry,
  setup,
  shows,
}: Cycle) => {
  const baseline = new Set(registry.getNodes().keys());
  const screen = await render(Toggle, { async, registry, setup, show: false });
  await repeat(cycles, async () => {
    await screen.rerender({ show: true });
    await expect.poll(text(screen)).toBe(shows);
    await screen.rerender({ show: false });
    await expect.poll(text(screen)).toBe("");
    await expect.poll(() => registry.getNodes().size).toBe(baseline.size);
    expect(
      [...registry.getNodes().keys()].every((key) => baseline.has(key))
    ).toBe(true);
  });
  await screen.unmount();
};

/** A writable atom that logs when it is computed and when it is disposed. */
const trackedWritable = (log: string[], name = "") =>
  Atom.writable(
    (get) => {
      log.push(name ? `start ${name}` : "start");
      get.addFinalizer(() => log.push(name ? `stop ${name}` : "stop"));
      return 1;
    },
    (ctx, value: number) => ctx.setSelf(value)
  );

/** An effect atom that logs when it is computed and when it is disposed. */
const trackedEffect = (log: string[], name = "") =>
  Atom.make((get) => {
    log.push(name ? `start ${name}` : "start");
    get.addFinalizer(() => log.push(name ? `stop ${name}` : "stop"));
    return Effect.succeed(name || "value").pipe(Effect.delay("10 millis"));
  });

/** Wraps a ref to count its live subscriptions, since an `AtomRef` lives outside any registry. */
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

describe("mount and unmount cycles leave nothing behind (JND-21)", () => {
  test("useAtomValue", async () => {
    const registry = AtomRegistry.make();
    const log: string[] = [];
    const atom = tracked(log);
    const doubled = Atom.make((get) => get(atom) * 2);
    await mountCycles({
      registry,
      setup: () => {
        const value = useAtomValue(doubled);
        const transformed = useAtomValue(atom, (n) => n + 1);
        return () => `${value.current} ${transformed.current}`;
      },
      shows: "2 2",
    });
    expect(log).toEqual(startStop(cycles));
  });

  test("useAtomSet", async () => {
    const registry = AtomRegistry.make();
    const log: string[] = [];
    const atom = trackedWritable(log);
    await mountCycles({
      registry,
      setup: () => {
        const set = useAtomSet(atom);
        // An updater reads the atom, so it is computed and has a finalizer to run.
        set((n) => n + 1);
        return () => "set";
      },
      shows: "set",
    });
    expect(log).toEqual(startStop(cycles));
  });

  test("useAtomSuspense", async () => {
    const registry = AtomRegistry.make();
    const log: string[] = [];
    const atom = trackedEffect(log);
    await mountCycles({
      async: true,
      registry,
      setup: () => {
        const value = useAtomSuspense(atom);
        return () => value.current;
      },
      shows: "value",
    });
    expect(log).toEqual(startStop(cycles));
  });

  test("useAtomSuspense read again and again outside a reaction holds its wait once (JND-59)", async () => {
    const registry = AtomRegistry.make();
    const atom = trackedEffect([]);
    const add = AbortSignal.prototype.addEventListener;
    let listeners = 0;
    AbortSignal.prototype.addEventListener = function addEventListener(
      this: AbortSignal,
      ...args: Parameters<AbortSignal["addEventListener"]>
    ) {
      if (args[0] === "abort") {
        listeners += 1;
      }
      add.apply(this, args);
    };
    try {
      const screen = await render(Toggle, {
        async: true,
        registry,
        setup: () => {
          const value = useAtomSuspense(atom);
          // Script reads have no reaction to say when they are done, so the component holds them.
          for (let index = 0; index < 50; index += 1) {
            void value.current;
          }
          return () => value.current;
        },
        show: true,
      });
      await expect.poll(text(screen)).toBe("value");
      expect(listeners).toBeLessThan(10);
      await screen.unmount();
    } finally {
      AbortSignal.prototype.addEventListener = add;
    }
  });

  test("useAtomResult", async () => {
    const registry = AtomRegistry.make();
    const log: string[] = [];
    const atom = trackedEffect(log);
    await mountCycles({
      async: true,
      registry,
      setup: async () => {
        const result = await useAtomResult(atom);
        return () => result.current._tag;
      },
      shows: "Success",
    });
    expect(log).toEqual(startStop(cycles));
  });

  test("useAtomRef", async () => {
    const registry = AtomRegistry.make();
    const ref = AtomRef.make({ count: 1 });
    const { counted, counter } = countSubscriptions(ref);
    await mountCycles({
      registry,
      setup: () => {
        const value = useAtomRef(counted);
        return () => value.current.count;
      },
      shows: "1",
    });
    expect(counter).toEqual({ active: 0, total: cycles });
  });

  test("an atom held outside the component is not disposed by its readers", async () => {
    const registry = AtomRegistry.make();
    const log: string[] = [];
    const atom = tracked(log);
    const release = registry.mount(atom);
    await mountCycles({
      registry,
      setup: () => {
        const value = useAtomValue(atom);
        return () => value.current;
      },
      shows: "1",
    });
    expect(log).toEqual(["start"]);
    release();
    await expect.poll(() => log).toEqual(["start", "stop"]);
    await expect.poll(() => registry.getNodes().size).toBe(0);
  });

  test("getter switches release every atom left behind", async () => {
    const registry = AtomRegistry.make();
    const log: string[] = [];
    const pick = Atom.make(0);
    const named = Atom.family((name: string) => trackedWritable(log, name));
    const screen = await render(Toggle, {
      registry,
      setup: () => {
        const choice = useAtomValue(pick);
        const value = useAtomValue(() => named(`${choice.current}`));
        const set = useAtomSet(() => named(`${choice.current}`));
        set((n) => n);
        return () => `${choice.current}:${value.current}`;
      },
      show: true,
    });
    let switches = 0;
    await repeat(cycles, async () => {
      switches += 1;
      registry.set(pick, switches);
      await expect.poll(text(screen)).toBe(`${switches}:1`);
      // Only the picker and the current atom stay alive.
      await expect.poll(() => registry.getNodes().size).toBe(2);
    });
    await screen.unmount();
    await expect.poll(() => registry.getNodes().size).toBe(0);
    const started = log.filter((entry) => entry.startsWith("start"));
    const stopped = log.filter((entry) => entry.startsWith("stop"));
    expect(started).toHaveLength(cycles + 1);
    expect(new Set(stopped)).toEqual(
      new Set(started.map((entry) => entry.replace("start", "stop")))
    );
    expect(stopped).toHaveLength(started.length);
  });

  test.each([
    { serializable: false, title: "" },
    // A serializable atom is also mounted by its seed, which must let go of it too (JND-59).
    { serializable: true, title: " (serializable)" },
  ])(
    "async getter switches release every atom left behind$title",
    async ({ serializable }) => {
      const registry = AtomRegistry.make();
      const log: string[] = [];
      const pick = Atom.make(0);
      const named = Atom.family((name: string) =>
        serializable
          ? trackedEffect(log, name).pipe(
              Atom.serializable({
                key: `leaks-${name}`,
                schema: AsyncResult.Schema({ success: Schema.String }),
              })
            )
          : trackedEffect(log, name)
      );
      const screen = await render(Toggle, {
        async: true,
        registry,
        setup: async () => {
          const choice = useAtomValue(pick);
          const suspended = useAtomSuspense(() => named(`${choice.current}`));
          const result = await useAtomResult(() => named(`${choice.current}`));
          return async () =>
            `${await suspended.current} ${result.current._tag}`;
        },
        show: true,
      });
      await expect.poll(text(screen)).toBe("0 Success");
      let switches = 0;
      await repeat(cycles, async () => {
        switches += 1;
        registry.set(pick, switches);
        await expect.poll(text(screen)).toBe(`${switches} Success`);
        await expect.poll(() => registry.getNodes().size).toBe(2);
      });
      await screen.unmount();
      await expect.poll(() => registry.getNodes().size).toBe(0);
      const started = log.filter((entry) => entry.startsWith("start"));
      expect(new Set(log)).toEqual(
        new Set([
          ...started,
          ...started.map((entry) => entry.replace("start", "stop")),
        ])
      );
      expect(log).toHaveLength(started.length * 2);
    }
  );

  test("unmounting while the script awaits, over and over", async () => {
    const registry = AtomRegistry.make();
    const log: string[] = [];
    const slow = Atom.make((get) => {
      log.push("start");
      get.addFinalizer(() => log.push("stop"));
      return Effect.never;
    });
    const screen = await render(ToggleScriptAwait, {
      registry,
      setup: async () => {
        const suspended = useAtomSuspense(slow);
        const result = await useAtomResult(slow);
        return `${result.current._tag} ${String(suspended)}`;
      },
      show: false,
    });
    await repeat(cycles, async () => {
      await screen.rerender({ show: true });
      await expect.poll(() => registry.getNodes().size).toBe(1);
      await screen.rerender({ show: false });
      await expect.poll(() => registry.getNodes().size).toBe(0);
    });
    await screen.unmount();
    expect(log).toEqual(startStop(cycles));
  });
});
