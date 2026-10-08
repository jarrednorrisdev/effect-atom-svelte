import { setTimeout as sleep } from "node:timers/promises";

import { Effect, Option } from "effect";
import { inspect } from "effect-atom-svelte/inspector";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { detail, preview } from "../src/internal/format.ts";
import { layout } from "../src/internal/layout.ts";
import { Model } from "../src/internal/model.svelte.ts";
import type { AtomView } from "../src/internal/model.svelte.ts";
import { identify, parseFrame } from "../src/internal/names.ts";

describe("format", () => {
  test("previews values on one line, cut short", () => {
    expect(preview(3)).toBe("3");
    expect(preview("dark")).toBe('"dark"');
    expect(preview({ a: [1, 2] })).toBe('{"a":[1,2]}');
    expect(preview("x".repeat(100), 10)).toBe('"xxxxxxxx…');
    expect(preview(new Map([["a", 1]]))).toBe('{"a":1}');
  });

  test("previews an AsyncResult by its value or failure, and says when it waits", () => {
    expect(preview(AsyncResult.success(4))).toBe("4");
    expect(preview(AsyncResult.success(4, { waiting: true }))).toBe(
      "4, waiting"
    );
    expect(preview(AsyncResult.initial())).toBe("Initial");
    expect(preview(AsyncResult.fail("boom"))).toContain("boom");
  });

  test("writes out a value in full, through Effect's toJSON, without looping", () => {
    const circular: Record<string, unknown> = { name: "loop" };
    circular.self = circular;
    expect(detail(circular)).toContain('"self": "[circular]"');
    expect(detail(Option.some(1))).toContain('"_tag": "Some"');
    expect(detail(() => 1)).toBe('"ƒ anonymous"');
  });
});

describe("names", () => {
  test("reads the place from the plugin's frames and from browser URLs", () => {
    expect(parseFrame("at todosAtom (/src/lib/todos.ts:4:14)")).toEqual({
      column: 14,
      file: "/src/lib/todos.ts",
      line: 4,
    });
    expect(
      parseFrame("    at http://localhost:5173/@fs/J:/app/src/a.ts?t=1:12:3")
    ).toEqual({ column: 3, file: "/J:/app/src/a.ts", line: 12 });
    expect(parseFrame("no place here")).toBeUndefined();
  });

  test("identifies an atom by its label and key", () => {
    const named = Atom.make(0).pipe(Atom.withLabel("countAtom"));
    expect(identify(named).name).toBe("countAtom");
    expect(identify(Atom.make(0)).name).toBeUndefined();
  });
});

// A view with only what the layout reads.
const view = (
  id: number,
  name: string,
  parents: number[] = [],
  plumbing = false
) => ({ id, live: true, name, parents, plumbing }) as unknown as AtomView;

describe("layout", () => {
  test("puts sources left and each atom right of its deepest parent", () => {
    const graph = layout(
      [view(0, "a"), view(1, "b", [0]), view(2, "c", [0, 1])],
      () => true
    );
    const x = new Map(graph.nodes.map((node) => [node.view.name, node.x]));
    expect(x.get("a")).toBeLessThan(x.get("b") ?? 0);
    expect(x.get("b")).toBeLessThan(x.get("c") ?? 0);
  });

  test("links an atom to the nearest drawn atom through hidden plumbing", () => {
    const graph = layout(
      [
        view(0, "source"),
        view(1, "runtime", [0], true),
        view(2, "derived", [1]),
      ],
      (item) => !item.plumbing
    );
    const derived = graph.nodes.find((node) => node.view.name === "derived");
    expect(graph.nodes).toHaveLength(2);
    expect(derived?.parents).toEqual([0]);
  });
});

describe("Model", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (f: () => void) => setTimeout(f, 0));
    vi.stubGlobal("cancelAnimationFrame", (handle: number) =>
      clearTimeout(handle)
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("shows the registry's atoms, hides unlabelled plumbing, and explains computations", async () => {
    const registry = AtomRegistry.make();
    const count = Atom.make(1).pipe(Atom.withLabel("count"));
    const hidden = Atom.make((get) => get(count) + 1);
    const total = Atom.make((get) => get(hidden) * 10).pipe(
      Atom.withLabel("total")
    );
    const model = new Model(inspect(registry));
    const stop = model.start();
    const release = registry.mount(total);
    registry.set(count, 2);
    await sleep(5);

    const byName = new Map(model.atoms.map((item) => [item.name, item]));
    expect(byName.get("total")?.value).toBe(30);
    expect(byName.get("count")?.plumbing).toBe(false);
    expect(model.atoms.filter((item) => item.plumbing)).toHaveLength(1);
    expect(model.totals.atoms).toBe(3);
    expect(model.unlabelled).toBe(false);
    const computed = model.timeline
      .filter((entry) => entry.tag === "Built")
      .map((entry) => entry.detail);
    expect(computed).toContain("count changed");

    release();
    stop();
    registry.dispose();
  });

  test("counts interruptions, and keeps a removed atom for a while", async () => {
    const registry = AtomRegistry.make();
    const forever = Atom.make(Effect.never).pipe(Atom.withLabel("forever"));
    const model = new Model(inspect(registry));
    const stop = model.start();
    const release = registry.mount(forever);
    release();
    await sleep(20);
    expect(model.totals.interruptions).toBe(1);
    const removed = model.atoms.find((item) => item.name === "forever");
    expect(removed?.live).toBe(false);
    expect(removed?.removedAt).toBeDefined();
    stop();
    registry.dispose();
  });

  test("says so when no atom has a label", async () => {
    const registry = AtomRegistry.make();
    const model = new Model(inspect(registry));
    const stop = model.start();
    registry.get(Atom.make(0).pipe(Atom.keepAlive));
    await sleep(5);
    expect(model.unlabelled).toBe(true);
    expect(model.atoms[0]?.plumbing).toBe(false);
    stop();
    registry.dispose();
  });
});
