import { Schema } from "effect";
import { Atom } from "effect/reactivity";
import { describe, expect, test } from "vitest";
import { render } from "vitest-browser-svelte";

import { useAtomValue } from "../src/index.ts";
import { provideInspectorScope } from "../src/Inspector.ts";
import type {
  InspectorScope,
  ScopeEvent,
  ScopeSnapshot,
} from "../src/Inspector.ts";
import Harness from "./fixtures/harness.svelte";
import ScopeHost from "./fixtures/scope-host.svelte";

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
});
