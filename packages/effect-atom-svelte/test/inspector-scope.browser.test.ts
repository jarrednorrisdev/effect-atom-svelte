import { Schema } from "effect";
import { Atom } from "effect/reactivity";
import type { AtomRegistry } from "effect/reactivity";
import { describe, expect, test } from "vitest";
import { render } from "vitest-browser-svelte";

import { getRegistry, useAtomValue } from "../src/index.ts";
import { provideInspectorScope } from "../src/Inspector.ts";
import type {
  InspectorScope,
  ScopeEvent,
  ScopeSnapshot,
} from "../src/Inspector.ts";
import Harness from "./fixtures/harness.svelte";
import ScopeHost from "./fixtures/scope-host.svelte";
import { sleep } from "./helpers.ts";

const mount = async (shown = true) => {
  let scope: InspectorScope | undefined;
  const screen = await render(ScopeHost, {
    onscope: (provided: InspectorScope) => {
      scope = provided;
    },
    shown,
  });
  await expect
    .poll(() => screen.container.querySelector("output")?.textContent)
    .toBe("3");
  if (scope === undefined) {
    throw new Error("No scope");
  }
  return { scope, screen };
};

/** A new atom object for one serializable key, as a hot reload makes. */
const sharedAtom = () =>
  Atom.make(1).pipe(
    Atom.serializable({ key: "shared-key", schema: Schema.Number }),
    Atom.withLabel("shared")
  );

const names = (snapshot: ScopeSnapshot) =>
  new Set(snapshot.nodes.map((node) => node.label ?? "?"));

/** Renders a scope that reads `atom`, with `prepare` run in the scope's registry first. */
const mountReading = async (
  atom: Atom.Atom<number>,
  shown: string,
  prepare: (registry: AtomRegistry.AtomRegistry) => void = () => undefined
) => {
  let scope: InspectorScope | undefined;
  let registry: AtomRegistry.AtomRegistry | undefined;
  const screen = await render(Harness, {
    setup: () => {
      scope = provideInspectorScope();
      registry = getRegistry();
      prepare(registry);
      const value = useAtomValue(atom);
      return () => value.current;
    },
  });
  await expect.poll(() => screen.container.textContent).toContain(shown);
  if (scope === undefined || registry === undefined) {
    throw new Error("No scope");
  }
  return { registry, scope, screen };
};

describe("provideInspectorScope", () => {
  test("shows the atoms read below it and those upstream, linked through plumbing", async () => {
    const { scope, screen } = await mount();
    const snapshot = scope.snapshot();
    expect(names(snapshot)).toEqual(new Set(["countAtom", "totalAtom"]));
    const id = (label: string) =>
      snapshot.nodes.find((node) => node.label === label)?.id;
    expect(snapshot.edges).toEqual([
      { from: id("countAtom"), to: id("totalAtom") },
    ]);
    expect(
      snapshot.readers.map(
        (reader) =>
          `${reader.component} ${reader.kind} ${reader.atom === id("totalAtom") ? "total" : "count"}`
      )
    ).toEqual(
      expect.arrayContaining([
        "ScopeReader read total",
        "ScopeReader write count",
      ])
    );
    expect(snapshot.readers).toHaveLength(2);
    expect(scope.snapshot({ plumbing: true }).nodes).toHaveLength(3);
    await screen.unmount();
  });

  test("passes on events for its atoms only, and says when its atoms change", async () => {
    const { scope, screen } = await mount();
    const events: ScopeEvent[] = [];
    const stop = scope.subscribe((event) => events.push(event));
    const snapshot = scope.snapshot();
    const total = snapshot.nodes.find((node) => node.label === "totalAtom");

    await screen.getByRole("button", { name: "add" }).click();
    await expect
      .poll(() => screen.container.querySelector("output")?.textContent)
      .toBe("5");
    const updated = events.filter((event) => event._tag === "Updated");
    expect(
      updated.some((event) => "id" in event && event.id === total?.id)
    ).toBe(true);
    // The atom read outside the scope, and the hidden plumbing's id, are never in its snapshot.
    const ids = new Set(
      scope.snapshot({ plumbing: true }).nodes.map((node) => node.id)
    );
    expect(updated.every((event) => "id" in event && ids.has(event.id))).toBe(
      true
    );

    events.length = 0;
    await screen.rerender({ shown: false });
    await expect
      .poll(() => events.some((event) => event._tag === "ScopeChanged"))
      .toBe(true);
    expect(scope.snapshot().readers).toEqual([]);
    stop();
    await screen.unmount();
  });

  test("points each reader of a serializable atom at a node in its snapshot", async () => {
    // Two atom objects with one key share a node, as after a hot reload: the second reader's atom
    // didn't make the node.
    const first = sharedAtom();
    const second = sharedAtom();
    let scope: InspectorScope | undefined;
    const screen = await render(Harness, {
      setup: () => {
        scope = provideInspectorScope();
        const held = useAtomValue(first);
        const value = useAtomValue(second);
        return () => `${held.current} ${value.current}`;
      },
    });
    await expect.poll(() => screen.container.textContent).toContain("1 1");
    const snapshot = scope?.snapshot();
    const ids = new Set(snapshot?.nodes.map((node) => node.id));
    expect(snapshot?.readers).toHaveLength(2);
    for (const reader of snapshot?.readers ?? []) {
      expect(ids.has(reader.atom)).toBe(true);
    }
    await screen.unmount();
  });

  test("says its atoms changed when an atom that mounts another switches dependencies", async () => {
    const flag = Atom.make(true).pipe(Atom.keepAlive, Atom.withLabel("flag"));
    const a = Atom.make(1).pipe(Atom.keepAlive, Atom.withLabel("a"));
    const b = Atom.make(2).pipe(Atom.keepAlive, Atom.withLabel("b"));
    const ticker = Atom.make(0).pipe(Atom.keepAlive, Atom.withLabel("ticker"));
    const child = Atom.make((get) => {
      get.mount(ticker);
      return get(flag) ? get(a) : get(b);
    }).pipe(Atom.withLabel("child"));
    const { registry, scope, screen } = await mountReading(child, "1", (r) =>
      r.get(b)
    );
    const events: ScopeEvent[] = [];
    const stop = scope.subscribe((event) => events.push(event));
    expect(names(scope.snapshot())).toEqual(new Set(["child", "flag", "a"]));
    registry.set(flag, false);
    await expect.poll(() => screen.container.textContent).toContain("2");
    await expect
      .poll(() => events.some((event) => event._tag === "ScopeChanged"))
      .toBe(true);
    expect(names(scope.snapshot())).toEqual(new Set(["child", "flag", "b"]));
    stop();
    await screen.unmount();
  });

  test("snapshot follows a dependency switch while nothing listens to the scope", async () => {
    const flag = Atom.make(true).pipe(Atom.keepAlive, Atom.withLabel("flag"));
    const a = Atom.make(1).pipe(Atom.keepAlive, Atom.withLabel("a"));
    const b = Atom.make(2).pipe(Atom.keepAlive, Atom.withLabel("b"));
    const child = Atom.make((get) => (get(flag) ? get(a) : get(b))).pipe(
      Atom.withLabel("child")
    );
    const { registry, scope, screen } = await mountReading(child, "1");
    expect(names(scope.snapshot())).toEqual(new Set(["child", "flag", "a"]));
    registry.set(flag, false);
    await expect.poll(() => screen.container.textContent).toContain("2");
    expect(names(scope.snapshot())).toEqual(new Set(["child", "flag", "b"]));
    // A listener that comes and goes, then a switch back while nobody listens.
    scope.subscribe(() => undefined)();
    registry.set(flag, true);
    await expect.poll(() => screen.container.textContent).toContain("1");
    const stop = scope.subscribe(() => undefined);
    expect(names(scope.snapshot())).toEqual(new Set(["child", "flag", "a"]));
    stop();
    await screen.unmount();
  });

  test("a listener that comes back doesn't hear an atom that left the scope while nobody listened", async () => {
    const flag = Atom.make(true).pipe(Atom.keepAlive, Atom.withLabel("flag"));
    const a = Atom.make(1).pipe(Atom.keepAlive, Atom.withLabel("a"));
    const b = Atom.make(2).pipe(Atom.keepAlive, Atom.withLabel("b"));
    const other = Atom.make(0).pipe(Atom.withLabel("other"));
    const child = Atom.make((get) => (get(flag) ? get(a) : get(b))).pipe(
      Atom.withLabel("child")
    );
    const { registry, scope, screen } = await mountReading(child, "1");
    // While listening, any change to the graph makes the scope work its nodes out again.
    const first = scope.subscribe(() => undefined);
    const release = registry.mount(other);
    await sleep("10 millis");
    first();
    registry.set(flag, false);
    await expect.poll(() => screen.container.textContent).toContain("2");
    const events: ScopeEvent[] = [];
    const stop = scope.subscribe((event) => events.push(event));
    expect(names(scope.snapshot())).toEqual(new Set(["child", "flag", "b"]));
    registry.set(a, 5);
    await sleep("10 millis");
    const ids = new Set(
      scope.snapshot({ plumbing: true }).nodes.map((node) => node.id)
    );
    // `a` was written, but the scope no longer reads it.
    expect(
      events.filter((event) => "id" in event && !ids.has(event.id))
    ).toEqual([]);
    stop();
    release();
    await screen.unmount();
  });
});
