<!--
  PROTOTYPE (landing hero variants, ?variant=d): throwaway, not for main.

  A dependency graph drawn on a hairline frame's own lines. Place it at the top-left of the frame
  (or of one ruled line); x is a fraction of its width, y is pixels down from its top. Lit edges are
  drawn in the accent, in order, the first time the graph scrolls into view.

  Every edge is a run of 1px borders, and every node sits on a 1px anchor, placed at the same CSS
  coordinate as the frame line under it. At a fractional display scale (150%, say) the browser
  rounds a 1px line to whole device pixels; drawn the same way from the same coordinate, the graph
  rounds the same way, so it stays on its line. Edges must be horizontal or vertical.
-->
<script module lang="ts">
  export type Kind = "effect" | "atom" | "component" | "junction" | "gone";

  export interface GraphNode {
    readonly x: number;
    readonly y: number;
    readonly kind: Kind;
    readonly label?: string;
    readonly note?: string;
    /** Which side of the node its label sits: north-east (the default), south-east, and so on. */
    readonly side?: "ne" | "se" | "nw" | "sw";
    /** The step at which it appears, with the edge that reaches it. */
    readonly step?: number;
  }

  export interface GraphEdge {
    readonly points: readonly (readonly [x: number, y: number])[];
    readonly lit?: boolean;
    readonly dashed?: boolean;
    readonly step?: number;
  }
</script>

<script lang="ts">
  /**
   * Where the frame's lines start, from the graph's box: `left` is the left edge of the line at
   * x = 0, `right` that of the line at x = 1 less the box's width, and `top` is added to every y.
   */
  const {
    edges,
    nodes,
    origin = { left: 0, right: -1, top: 0 },
  }: {
    edges: readonly GraphEdge[];
    nodes: readonly GraphNode[];
    origin?: { readonly left: number; readonly right: number; readonly top: number };
  } = $props();

  // contentRect keeps fractions of a pixel, which clientWidth would round away.
  let rect = $state<DOMRectReadOnly>();
  const width = $derived(rect?.width ?? 0);
  let drawn = $state(false);

  const draw = (element: HTMLElement) => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          drawn = true;
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -20% 0px" }
    );
    observer.observe(element);
    return () => observer.disconnect();
  };

  const px = (x: number) => (x === 0 ? origin.left : x === 1 ? width + origin.right : x * width);
  const py = (y: number) => y + origin.top;

  interface Segment {
    readonly left: number;
    readonly top: number;
    readonly length: number;
    readonly vertical: boolean;
    /** Drawn from its far end: right to left, or bottom to top. */
    readonly reversed: boolean;
  }

  /** An edge's runs, each covering both of its end pixels so runs meet without a gap. */
  const segments = (edge: GraphEdge): Segment[] =>
    edge.points.slice(1).map(([x, y], index) => {
      const [fromX, fromY] = edge.points[index]!;
      const [x1, y1, x2, y2] = [px(fromX), py(fromY), px(x), py(y)];
      const vertical = x1 === x2;
      return {
        left: Math.min(x1, x2),
        length: (vertical ? Math.abs(y2 - y1) : Math.abs(x2 - x1)) + 1,
        reversed: vertical ? y2 < y1 : x2 < x1,
        top: Math.min(y1, y2),
        vertical,
      };
    });
</script>

<div
  {@attach draw}
  aria-hidden="true"
  bind:contentRect={rect}
  class="graph"
  class:drawn
>
  {#if width}
    {#each edges as edge, index (index)}
      {#each segments(edge) as segment, part (part)}
        <span
          style:--step={edge.step ?? 0}
          style:--part={part}
          style:left="{segment.left}px"
          style:top="{segment.top}px"
          style:width={segment.vertical ? undefined : `${segment.length}px`}
          style:height={segment.vertical ? `${segment.length}px` : undefined}
          class={[
            "edge",
            segment.vertical ? "vertical" : "horizontal",
            segment.reversed && "reversed",
            edge.lit && "lit",
            edge.dashed && "dashed",
          ]}
        ></span>
      {/each}
    {/each}
  {/if}
  {#each nodes as node, index (index)}
    <span
      style:--step={node.step ?? 0}
      style:left="{px(node.x)}px"
      style:top="{py(node.y)}px"
      class="node {node.kind} {node.side ?? 'ne'}"
    >
      <i></i>
      {#if node.label}
        <span class="label">
          {node.label}
          {#if node.note}<em>{node.note}</em>{/if}
        </span>
      {/if}
    </span>
  {/each}
</div>

<style>
  .graph {
    height: 0;
    inset: 0 0 auto;
    pointer-events: none;
    position: absolute;
    z-index: 2;
  }
  /* A run of an edge: a 1px border, like the frame's own lines. */
  .edge {
    --edge: color-mix(in oklab, var(--foreground) 30%, transparent);
    position: absolute;
  }
  .edge.horizontal {
    border-top: 1px solid var(--edge);
    height: 0;
    transform-origin: left;
  }
  .edge.vertical {
    border-left: 1px solid var(--edge);
    transform-origin: top;
    width: 0;
  }
  .edge.horizontal.reversed {
    transform-origin: right;
  }
  .edge.vertical.reversed {
    transform-origin: bottom;
  }
  .edge.dashed {
    border-style: dashed;
  }
  .edge.lit {
    --edge: var(--brand);
  }
  /* A node's anchor is the 1px square of line it sits on; its mark is centred on that square. */
  .node {
    height: 1px;
    position: absolute;
    width: 1px;
  }
  /* Centring a mark on a 1px line takes an odd size and whole-pixel borders: a 9px mark then sits
     exactly 4px either side of the line, so every edge of it falls on the same fraction of a device
     pixel as the line's own edges, at any display scale (at 150% nothing lands on whole device
     pixels, and a mark that didn't share the line's fraction would blur unevenly and look off). */
  .node i {
    --size: 9px;
    background: var(--background);
    border: 1px solid var(--subtle-foreground);
    height: var(--size);
    left: calc((1px - var(--size)) / 2);
    position: absolute;
    top: calc((1px - var(--size)) / 2);
    width: var(--size);
  }
  /* A square turned on its corner: 7px across its sides is about 10px across its corners. */
  .node.effect i {
    --size: 7px;
    background: var(--foreground);
    border-color: var(--foreground);
    rotate: 45deg;
  }
  .node.atom i {
    border-color: var(--brand);
    border-radius: 50%;
    border-width: 2px;
    box-shadow: 0 0 0 3px var(--background);
  }
  .node.component i {
    border-color: var(--foreground);
    border-radius: 1.5px;
  }
  .node.junction i {
    --size: 5px;
    background: var(--brand);
    border: 0;
    border-radius: 50%;
  }
  .node.gone i {
    background:
      linear-gradient(45deg, transparent 45%, var(--brand-text) 45% 55%, transparent 55%),
      linear-gradient(-45deg, transparent 45%, var(--brand-text) 45% 55%, transparent 55%);
    border: 0;
  }
  .label {
    background: var(--background);
    color: var(--foreground);
    font-family: var(--font-mono);
    font-size: 0.7rem;
    line-height: 1.3;
    padding: 0 0.3rem;
    position: absolute;
    white-space: nowrap;
  }
  .label em {
    color: var(--muted-foreground);
    display: block;
    font-family: "Libron", ui-serif, Georgia, serif;
    font-size: 0.72rem;
    font-style: italic;
  }
  .ne .label {
    bottom: 0.45rem;
    left: 0.45rem;
  }
  .se .label {
    left: 0.45rem;
    top: 0.45rem;
  }
  .nw .label {
    bottom: 0.45rem;
    right: 0.45rem;
    text-align: right;
  }
  .sw .label {
    right: 0.45rem;
    text-align: right;
    top: 0.45rem;
  }
  /* Drawn once, in order, when first seen: each lit edge, then the node it reaches. */
  @media (prefers-reduced-motion: no-preference) {
    .edge.lit.horizontal {
      scale: 0 1;
    }
    .edge.lit.vertical {
      scale: 1 0;
    }
    .drawn .edge.lit {
      animation: draw 0.7s cubic-bezier(0.4, 0, 0.2, 1) both;
      animation-delay: calc(var(--step) * 0.45s + var(--part) * 0.15s + 0.2s);
    }
    .node {
      opacity: 0;
    }
    .drawn .node {
      animation: appear 0.4s ease-out both;
      animation-delay: calc(var(--step) * 0.45s + 0.2s);
    }
  }
  @keyframes draw {
    to {
      scale: 1;
    }
  }
  @keyframes appear {
    from {
      opacity: 0;
      transform: translateY(2px);
    }
    to {
      opacity: 1;
    }
  }
</style>
