// Where the graph draws each atom: in columns by depth, sources on the left and each atom one
// column right of its deepest parent, ordered within a column to keep edges short. Computed when
// the graph changes, not every frame; nodes move to new places with a CSS transition.
import type { AtomView } from "./model.svelte.ts";

export interface GraphNode {
  readonly view: AtomView;
  readonly x: number;
  readonly y: number;
  /** The nearest atoms upstream that are drawn, through any hidden plumbing between. */
  readonly parents: readonly number[];
}

export interface Graph {
  readonly nodes: readonly GraphNode[];
  readonly width: number;
  readonly height: number;
}

export const columnWidth = 230;
export const rowHeight = 56;
const margin = { left: 24, top: 36 };

/** The drawn atoms upstream of `view`, looking through those not drawn, as far as six steps. */
const visibleParents = (
  view: AtomView,
  byId: ReadonlyMap<number, AtomView>,
  shown: ReadonlySet<number>
): number[] => {
  const found = new Set<number>();
  const walk = (ids: readonly number[], steps: number) => {
    for (const id of ids) {
      if (shown.has(id)) {
        found.add(id);
      } else if (steps < 6) {
        walk(byId.get(id)?.parents ?? [], steps + 1);
      }
    }
  };
  walk(view.parents, 0);
  found.delete(view.id);
  return [...found];
};

export const layout = (
  views: readonly AtomView[],
  show: (view: AtomView) => boolean
): Graph => {
  const byId = new Map(views.map((view) => [view.id, view]));
  const drawn = views.filter(show);
  const shown = new Set(drawn.map((view) => view.id));
  const parentsOf = new Map(
    drawn.map((view) => [view.id, visibleParents(view, byId, shown)])
  );

  // Depth: the longest chain of drawn parents, guarded against cycles.
  const depths = new Map<number, number>();
  const depthOf = (id: number, visiting: Set<number>): number => {
    const known = depths.get(id);
    if (known !== undefined) {
      return known;
    }
    if (visiting.has(id)) {
      return 0;
    }
    visiting.add(id);
    const parents = parentsOf.get(id) ?? [];
    const depth =
      parents.length === 0
        ? 0
        : 1 + Math.max(...parents.map((parent) => depthOf(parent, visiting)));
    visiting.delete(id);
    depths.set(id, depth);
    return depth;
  };
  const columns: AtomView[][] = [];
  for (const view of drawn) {
    const depth = depthOf(view.id, new Set());
    (columns[depth] ??= []).push(view);
  }

  // Rows: the first column by name, each later one by the average row of its parents.
  const rows = new Map<number, number>();
  for (const [index, column] of columns.entries()) {
    if (column === undefined) {
      continue;
    }
    const weight = (view: AtomView) => {
      const parents = (parentsOf.get(view.id) ?? []).map(
        (parent) => rows.get(parent) ?? 0
      );
      return parents.length === 0
        ? Number.POSITIVE_INFINITY
        : parents.reduce((sum, row) => sum + row, 0) / parents.length;
    };
    const sorted =
      index === 0
        ? column.toSorted((a, b) => a.name.localeCompare(b.name))
        : column.toSorted(
            (a, b) => weight(a) - weight(b) || a.name.localeCompare(b.name)
          );
    for (const [row, view] of sorted.entries()) {
      rows.set(view.id, row);
    }
  }

  const nodes = drawn.map((view) => ({
    parents: parentsOf.get(view.id) ?? [],
    view,
    x: margin.left + depthOf(view.id, new Set()) * columnWidth,
    y: margin.top + (rows.get(view.id) ?? 0) * rowHeight,
  }));
  const tallest = Math.max(0, ...columns.map((column) => column?.length ?? 0));
  return {
    height: margin.top * 2 + Math.max(1, tallest) * rowHeight,
    nodes,
    width: margin.left * 2 + Math.max(1, columns.length) * columnWidth,
  };
};
