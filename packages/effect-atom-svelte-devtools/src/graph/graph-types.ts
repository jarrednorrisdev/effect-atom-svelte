/** The graph frame-graph.svelte draws: its nodes and the edges between them. */

export type Kind = "effect" | "atom" | "component" | "junction" | "gone";

/** Which side of a node its label sits: north-east, south-east, and so on. */
type Side = "ne" | "se" | "nw" | "sw";

export interface GraphNode {
  readonly x: number;
  readonly y: number;
  readonly kind: Kind;
  readonly label?: string | undefined;
  readonly note?: string | undefined;
  /** Which side of the node its label sits: north-east (the default), south-east, and so on. */
  readonly side?: Side | undefined;
  /** The step at which it appears, with the edge that reaches it. */
  readonly step?: number | undefined;
  /** Names the node, for a live graph to find it again (`data-node`) and pulse it. */
  readonly id?: string | undefined;
}

export interface GraphEdge {
  readonly points: readonly (readonly [x: number, y: number])[];
  readonly lit?: boolean | undefined;
  readonly dashed?: boolean | undefined;
  readonly step?: number | undefined;
  /** The node it leads to (`data-to`), so a live graph can light the edges into a node. */
  readonly to?: string | undefined;
  /** Keeps an edge's element across redraws of a live graph. */
  readonly id?: string | undefined;
}
