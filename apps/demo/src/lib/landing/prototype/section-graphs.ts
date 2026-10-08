// PROTOTYPE (landing hero variants, ?variant=d): throwaway, not for main.
//
// Each reason's top line, drawn as the graph of its example: the Effect, the atom, and what reads
// it. x is a fraction of the line (0.4 is where the reason's two columns meet), y is pixels below
// it; labels sit above the line, in the space between sections.
import type { GraphEdge, GraphNode } from "#lib/docs/kit/frame-graph.svelte";

interface SectionGraph {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

const fork = 16;

export const sectionGraphs: Record<string, SectionGraph> = {
  "shared-effect": {
    edges: [
      { lit: true, points: [[0, 0], [0.4, 0]], step: 0 },
      { lit: true, points: [[0.4, 0], [0.7, 0]], step: 1 },
      { lit: true, points: [[0.4, 0], [0.4, fork], [1, fork], [1, 0]], step: 1 },
    ],
    nodes: [
      { kind: "effect", label: "fetchRate", note: "an Effect<string>", x: 0 },
      { kind: "atom", label: "rateAtom", note: "runs fetchRate once", step: 1, x: 0.4 },
      { kind: "component", label: "rate.svelte", note: "read in the header", step: 2, x: 0.7 },
      { kind: "component", label: "rate.svelte", note: "read in the checkout", side: "nw", step: 2, x: 1 },
    ].map((node) => ({ ...node, y: 0 }) as GraphNode),
  },
  "typed-errors": {
    edges: [
      { lit: true, points: [[0, 0], [0.4, 0]], step: 0 },
      { lit: true, points: [[0.4, 0], [1, 0]], step: 1 },
    ],
    nodes: [
      { kind: "effect", label: "TodosRpc.getTodo", note: "typed by the server's schema", x: 0, y: 0 },
      {
        kind: "atom",
        label: "getTodo({ id })",
        note: "holds an AsyncResult<Todo, TodoNotFound>",
        step: 1,
        x: 0.4,
        y: 0,
      },
      {
        kind: "component",
        label: "todo-lookup.svelte",
        note: "matches on TodoNotFound",
        side: "nw",
        step: 2,
        x: 1,
        y: 0,
      },
    ],
  },
  cleanup: {
    edges: [
      { lit: true, points: [[0, 0], [0.4, 0]], step: 0 },
      { dashed: true, points: [[0.4, 0], [1, 0]] },
    ],
    nodes: [
      { kind: "effect", label: "buildReport", note: "an Effect<string>", x: 0, y: 0 },
      { kind: "atom", label: "reportAtom", note: "nothing reads it now", step: 1, x: 0.4, y: 0 },
      { kind: "gone", label: "interrupted", note: "its onInterrupt handler runs", step: 2, x: 0.7, y: 0 },
      { kind: "component", label: "report.svelte", note: "hidden, so it stopped reading", side: "nw", step: 2, x: 1, y: 0 },
    ],
  },
  "typed-backend": {
    edges: [
      { lit: true, points: [[0, 0], [0.28, 0]], step: 0 },
      { lit: true, points: [[0.28, 0], [0.55, 0]], step: 1 },
      { lit: true, points: [[0.55, 0], [1, 0]], step: 2 },
      { lit: true, points: [[0.8, fork], [0.28, fork], [0.28, 0]], step: 3 },
    ],
    nodes: [
      { kind: "effect", label: "TodosRpc.listTodos", note: "the query", x: 0, y: 0 },
      { kind: "atom", label: "todosAtom", note: 'tagged "todos"', step: 1, x: 0.28, y: 0 },
      { kind: "atom", label: "openCountAtom", note: "derived from todosAtom", step: 2, x: 0.55, y: 0 },
      { kind: "component", label: "todo-list.svelte", side: "nw", step: 3, x: 1, y: 0 },
      {
        kind: "effect",
        label: "createTodo",
        note: 'on success, refetches "todos"',
        side: "se",
        step: 3,
        x: 0.8,
        y: fork,
      },
    ],
  },
};
