import { describe, expect, test } from "vitest";

import { layoutGraph } from "../src/graph/layout.ts";
import type { GraphInput } from "../src/graph/layout.ts";

const width = 800;

/** The value, or a failed test if there isn't one. */
const must = <T>(value: T | undefined): T => {
  if (value === undefined) {
    throw new Error("expected a value");
  }
  return value;
};
const nodeOf = (input: GraphInput, label: string) =>
  layoutGraph(input, width)?.nodes.find((node) => node.label === label);

describe("layoutGraph", () => {
  test("draws nothing for no atoms", () => {
    expect(layoutGraph({ atoms: [], links: [] }, width)).toBeUndefined();
  });

  test("puts sources left of what derives from them, on the parent's track", () => {
    const input: GraphInput = {
      atoms: [
        { id: 0, label: "countAtom" },
        { id: 1, label: "doubledAtom" },
      ],
      links: [{ from: 0, to: 1 }],
    };
    const count = must(nodeOf(input, "countAtom"));
    const doubled = must(nodeOf(input, "doubledAtom"));
    expect(count.x).toBeLessThan(doubled.x);
    expect(count.y).toBe(doubled.y);
  });

  test("puts components in a column of their own, after the atoms", () => {
    const input: GraphInput = {
      atoms: [{ id: 0, label: "countAtom" }],
      links: [],
      readers: [{ atom: 0, kind: "read", name: "counter.svelte" }],
    };
    const component = layoutGraph(input, width)?.nodes.find((node) => node.kind === "component");
    expect(component?.label).toBe("counter.svelte");
    expect(must(component).x).toBeGreaterThan(must(nodeOf(input, "countAtom")).x);
  });

  test("shows instances that use the same atoms as one component with a count", () => {
    const input: GraphInput = {
      atoms: [{ id: 0, label: "logAtom" }],
      links: [],
      readers: [0, 1, 2].map((instance) => ({ atom: 0, instance, kind: "read", name: "card.svelte" })),
    };
    expect(nodeOf(input, "card.svelte ×3")).toBeDefined();
  });

  test("keeps the track of an atom a component reads clear for it", () => {
    // taste.svelte reads countAtom directly, so doubledAtom starts a track of its own.
    const input: GraphInput = {
      atoms: [
        { id: 0, label: "countAtom" },
        { id: 1, label: "doubledAtom" },
      ],
      links: [{ from: 0, to: 1 }],
      readers: [
        { atom: 0, kind: "read", name: "taste.svelte" },
        { atom: 1, kind: "read", name: "taste.svelte" },
      ],
    };
    expect(must(nodeOf(input, "doubledAtom")).y).toBeGreaterThan(must(nodeOf(input, "countAtom")).y);
  });

  test("puts a family's atoms on one row of dots, flagging a key seen twice", () => {
    const input: GraphInput = {
      atoms: [
        { id: 0, label: 'draftAtom({"doc":1})', read: true },
        { id: 1, label: 'draftAtom({"doc":2})' },
        { id: 2, label: 'draftAtom({"doc":1})' },
      ],
      links: [],
    };
    const layout = must(layoutGraph(input, width));
    expect(layout.nodes.map((node) => node.label)).toEqual(["draftAtom(…)"]);
    expect(layout.nodes[0]?.note).toBe("3 atoms for 2 keys · 1 repeat a key");
    expect(layout.dots[0]?.dots.map((dot) => [dot.key, dot.repeat])).toEqual([
      ["1", false],
      ["2", false],
      ["1", true],
    ]);
  });

  test("leaves a family's atoms as their own rows when several are read at once", () => {
    const input: GraphInput = {
      atoms: [1, 2, 3].map((id) => ({ id, label: `todoAtom(${id})`, read: true })),
      links: [],
    };
    expect(layoutGraph(input, width)?.dots).toEqual([]);
  });

  test("breaks a line where another edge crosses it, but not where lines join", () => {
    // summary.svelte reads aAtom and cAtom: its collector runs down from cAtom's track to aAtom's,
    // across bAtom's line to bAtom's own reader in between.
    const input: GraphInput = {
      atoms: [
        { id: 0, label: "aAtom" },
        { id: 1, label: "bAtom" },
        { id: 2, label: "cAtom" },
      ],
      links: [],
      readers: [
        { atom: 0, kind: "read", name: "summary.svelte" },
        { atom: 2, kind: "read", name: "summary.svelte" },
        { atom: 1, kind: "read", name: "b.svelte" },
      ],
    };
    const { edges } = must(layoutGraph(input, width));
    const pieces = (from: string) => edges.filter((edge) => edge.id?.startsWith(`${from}>`));
    // bAtom's line is crossed, so it's in two pieces; aAtom's and cAtom's join on the collector and
    // are whole.
    expect(pieces("a1")).toHaveLength(2);
    expect(pieces("a0")).toHaveLength(1);
    expect(pieces("a2")).toHaveLength(1);
  });

  test("draws a removed atom crossed", () => {
    const input: GraphInput = {
      atoms: [{ id: 0, label: "plainAtom", status: "removed" }],
      links: [],
    };
    expect(nodeOf(input, "plainAtom")?.kind).toBe("gone");
  });
});
