import { Effect } from "effect";
import { Atom, AtomRegistry } from "effect/reactivity";
import { describe, expect, test } from "vitest";
import { render } from "vitest-browser-svelte";

import { getRegistry, useAtomValue } from "../src/index.ts";
import { inspect, registries, watchRegistries } from "../src/Inspector.ts";
import type { Event } from "../src/Inspector.ts";
import Harness from "./fixtures/harness.svelte";
import { sleep } from "./helpers.ts";

const name = (node: AtomRegistry.Node<unknown>) => node.atom.label?.[0] ?? "?";

/** One line per event, enough to tell what happened to which atom. */
const describeEvent = (event: Event): string => {
  switch (event._tag) {
    case "Built": {
      const cause =
        event.cause._tag === "ParentChanged"
          ? `ParentChanged(${event.cause.parents.map(name).join(", ")})`
          : event.cause._tag;
      return `Built ${name(event.node)} ${cause}`;
    }
    case "Updated": {
      return `Updated ${name(event.node)} ${String(event.previous)} -> ${String(event.value)} (${event.source})`;
    }
    case "ReadersChanged": {
      return `ReadersChanged ${name(event.node)} ${event.readers}`;
    }
    case "Finalized": {
      return `Finalized ${name(event.node)} ${event.finalizers}`;
    }
    default: {
      return `${event._tag} ${name(event.node)}`;
    }
  }
};

const record = (registry: AtomRegistry.AtomRegistry) => {
  const log: string[] = [];
  inspect(registry).subscribe((event) => log.push(describeEvent(event)));
  return log;
};

describe("inspect", () => {
  test("reports nodes added, computed and updated, with why and from where", () => {
    const registry = AtomRegistry.make();
    const count = Atom.make(1).pipe(Atom.withLabel("count"));
    const double = Atom.make((get) => get(count) * 2).pipe(
      Atom.withLabel("double")
    );
    const log = record(registry);

    const release = registry.mount(double);
    expect(log).toEqual([
      "NodeAdded double",
      "Built double FirstRead",
      "NodeAdded count",
      "Built count FirstRead",
      "Updated count undefined -> 1 (build)",
      "Updated double undefined -> 2 (build)",
      "ReadersChanged double 1",
    ]);

    log.length = 0;
    registry.set(count, 5);
    expect(log).toEqual([
      "Updated count 1 -> 5 (write)",
      "Built double ParentChanged(count)",
      "Updated double 2 -> 10 (build)",
    ]);
    release();
    registry.dispose();
  });

  test("says when a computation was asked for with refresh", () => {
    const registry = AtomRegistry.make();
    let runs = 0;
    const counter = Atom.make(() => {
      runs += 1;
      return runs;
    }).pipe(Atom.withLabel("counter"));
    const release = registry.mount(counter);
    const log = record(registry);
    registry.refresh(counter);
    expect(log).toEqual([
      "Built counter Refreshed",
      "Updated counter 1 -> 2 (build)",
    ]);
    release();
    registry.dispose();
  });

  test("watches the nodes a registry already held", () => {
    const registry = AtomRegistry.make();
    const count = Atom.make(1).pipe(Atom.keepAlive, Atom.withLabel("count"));
    registry.get(count);
    const log = record(registry);
    registry.set(count, 2);
    expect(log).toEqual(["Updated count 1 -> 2 (write)"]);
    registry.dispose();
  });

  test("counts readers as they come and go", () => {
    const registry = AtomRegistry.make();
    const count = Atom.make(1).pipe(Atom.withLabel("count"));
    const log = record(registry);
    const first = registry.mount(count);
    const second = registry.subscribe(count, () => undefined);
    second();
    first();
    expect(log.filter((line) => line.startsWith("ReadersChanged"))).toEqual([
      "ReadersChanged count 1",
      "ReadersChanged count 2",
      "ReadersChanged count 1",
      "ReadersChanged count 0",
    ]);
    registry.dispose();
  });

  test("reports an effect that settles after its computation as async", async () => {
    const registry = AtomRegistry.make();
    const slow = Atom.make(Effect.as(Effect.sleep(10), "done")).pipe(
      Atom.withLabel("slow")
    );
    const updates: string[] = [];
    inspect(registry).subscribe((event) => {
      if (event._tag === "Updated") {
        updates.push(event.source);
      }
    });
    const release = registry.mount(slow);
    await expect.poll(() => updates).toEqual(["build", "async"]);
    release();
    registry.dispose();
  });

  test("reports an effect interrupted when its last reader goes, then its finalizers and removal", async () => {
    const registry = AtomRegistry.make();
    const forever = Atom.make(Effect.never).pipe(Atom.withLabel("forever"));
    const release = registry.mount(forever);
    const log = record(registry);
    release();
    await expect
      .poll(() => log)
      .toEqual([
        "ReadersChanged forever 0",
        "Interrupted forever",
        "Finalized forever 2",
        "NodeRemoved forever",
      ]);
    registry.dispose();
  });

  test("reports finalizers without an interruption for an effect that finished", async () => {
    const registry = AtomRegistry.make();
    const done = Atom.make(Effect.succeed(1)).pipe(Atom.withLabel("done"));
    const release = registry.mount(done);
    const log = record(registry);
    release();
    await sleep(20);
    expect(log).not.toContain("Interrupted done");
    expect(log).toContain("NodeRemoved done");
    registry.dispose();
  });

  test("reports a node removed after its idle TTL once its teardown is reported", async () => {
    const registry = AtomRegistry.make();
    const forever = Atom.make(Effect.never).pipe(
      Atom.setIdleTTL(20),
      Atom.withLabel("forever")
    );
    const release = registry.mount(forever);
    const log = record(registry);
    release();
    await expect
      .poll(() => log, { timeout: 3000 })
      .toContain("NodeRemoved forever");
    await sleep(20);
    expect(log).toEqual([
      "ReadersChanged forever 0",
      "Interrupted forever",
      "Finalized forever 2",
      "NodeRemoved forever",
    ]);
    registry.dispose();
  });

  test("reports the readers registry.reset drops", () => {
    const registry = AtomRegistry.make();
    const count = Atom.make(1).pipe(Atom.withLabel("count"));
    const release = registry.mount(count);
    const log = record(registry);
    registry.reset();
    expect(log).toContain("ReadersChanged count 0");
    release();
    registry.dispose();
  });

  test("names only the parent that changed since a lazy atom last computed", () => {
    const registry = AtomRegistry.make();
    const c = Atom.make(1).pipe(Atom.keepAlive, Atom.withLabel("c"));
    const d = Atom.make(1).pipe(Atom.keepAlive, Atom.withLabel("d"));
    const b = Atom.make((get) => get(c) * 2).pipe(
      Atom.keepAlive,
      Atom.withLabel("b")
    );
    const a = Atom.make((get) => get(b) + get(d)).pipe(
      Atom.keepAlive,
      Atom.withLabel("a")
    );
    registry.get(a);
    const log = record(registry);
    // a computes b on reading it, and b's change comes while a is computing, before a has read it:
    // a reads the new value, so the change isn't a cause of a's next computation.
    registry.set(c, 2);
    registry.get(a);
    log.length = 0;
    registry.set(d, 2);
    registry.get(a);
    expect(log.filter((line) => line.startsWith("Built"))).toEqual([
      "Built a ParentChanged(d)",
    ]);
    registry.dispose();
  });

  test("reports the first computation of a node that held an initial value as its first read", () => {
    const count = Atom.make(() => 0).pipe(Atom.withLabel("count"));
    const registry = AtomRegistry.make({ initialValues: [[count, 5]] });
    const log = record(registry);
    expect(registry.get(count)).toBe(5);
    expect(log.filter((line) => line.startsWith("Built"))).toEqual([
      "Built count FirstRead",
    ]);
    registry.dispose();
  });

  test("returns one inspector per registry, and gives idle TTLs", () => {
    const registry = AtomRegistry.make({ defaultIdleTTL: 400 });
    const inspector = inspect(registry);
    expect(inspect(registry)).toBe(inspector);
    expect(inspector.complete).toBe(true);
    expect(inspector.idleTTL(Atom.make(0))).toBe(400);
    expect(inspector.idleTTL(Atom.make(0).pipe(Atom.setIdleTTL(50)))).toBe(50);
    expect(
      inspector.idleTTL(Atom.make(0).pipe(Atom.keepAlive))
    ).toBeUndefined();
    expect(inspect(AtomRegistry.make()).idleTTL(Atom.make(0))).toBeUndefined();
    registry.dispose();
  });

  test("keeps a listener that throws from breaking the registry", () => {
    const registry = AtomRegistry.make();
    const count = Atom.make(1);
    const original = console.error;
    console.error = () => undefined;
    try {
      inspect(registry).subscribe(() => {
        throw new Error("listener");
      });
      registry.set(count, 2);
      expect(registry.get(count)).toBe(2);
    } finally {
      console.error = original;
    }
    registry.dispose();
  });

  test("a refresh that changes nothing doesn't make a later computation 'Refreshed'", () => {
    const registry = AtomRegistry.make();
    const base = Atom.make(1).pipe(Atom.withLabel("base"));
    const double = base.pipe(
      Atom.map((n) => n * 2),
      Atom.withLabel("double")
    );
    const release = registry.mount(double);
    const log = record(registry);
    registry.refresh(double);
    log.length = 0;
    registry.set(base, 5);
    expect(log).toEqual([
      "Updated base 1 -> 5 (write)",
      "Built double ParentChanged(base)",
      "Updated double 2 -> 10 (build)",
    ]);
    release();
    registry.dispose();
  });
});

describe("registries", () => {
  test("lists a provider's registry while it is mounted", async () => {
    let provided: AtomRegistry.AtomRegistry | undefined;
    const seen: number[] = [];
    const stop = watchRegistries((list) => seen.push(list.length));
    const screen = await render(Harness, {
      setup: () => {
        provided = getRegistry();
        useAtomValue(Atom.make(1));
        return () => "ready";
      },
    });
    expect(registries()).toContain(provided);
    await screen.unmount();
    expect(registries()).not.toContain(provided);
    stop();
    expect(seen.length).toBeGreaterThanOrEqual(3);
  });
});
