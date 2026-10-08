import { describe, expect, test } from "vitest";
import { render } from "vitest-browser-svelte";

import type {
  InspectorScope,
  ScopeEvent,
  ScopeSnapshot,
} from "../src/Inspector.ts";
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
});
