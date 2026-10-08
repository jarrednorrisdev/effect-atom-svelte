<!--
  The live dependency graph: an edge from each atom to each atom that reads it, a tick per reader,
  a pulse when a value changes, a cross when an effect is interrupted or the atom is removed.
-->
<script lang="ts">
  import { stateText,preview } from "./format.ts";
  import { columnWidth, layout } from "./layout.ts";
  import type { GraphNode } from "./layout.ts";
  import type { AtomView } from "./model.svelte.ts";
  import { lingerFor } from "./model.svelte.ts";
  
  interface Props {
    readonly atoms: readonly AtomView[];
    readonly showPlumbing: boolean;
    readonly selected: number | undefined;
    readonly onselect: (id: number) => void;
  }

  const { atoms, showPlumbing, selected, onselect }: Props = $props();

  const shown = (view: AtomView) =>
    (showPlumbing || !view.plumbing) &&
    (view.live ||
      (view.removedAt !== undefined &&
        performance.now() - view.removedAt < lingerFor));

  const graph = $derived(layout(atoms, shown));
  const byId = $derived(new Map(graph.nodes.map((node) => [node.view.id, node])));

  // How many updates each atom had when the graph first drew it: only later ones pulse, so opening
  // the panel doesn't set every atom off at once.
  const baseline = new Map<number, number>();
  const pulses = (view: AtomView) => {
    const first = baseline.get(view.id);
    if (first === undefined) {
      baseline.set(view.id, view.updates);
      return 0;
    }
    return view.updates - first;
  };
  const interruptions = new Map<number, number>();
  const crosses = (view: AtomView) => {
    const first = interruptions.get(view.id);
    if (first === undefined) {
      interruptions.set(view.id, view.interruptions);
      return 0;
    }
    return view.interruptions - first;
  };

  const edge = (from: GraphNode, to: GraphNode) => {
    const x1 = from.x + 8;
    const x2 = to.x - 8;
    const bend = Math.max(40, (x2 - x1) / 2);
    return `M ${x1} ${from.y} C ${x1 + bend} ${from.y}, ${x2 - bend} ${to.y}, ${x2} ${to.y}`;
  };

  const note = (view: AtomView) => {
    if (!view.live) {
      return "removed · finalizers ran";
    }
    const state = stateText(view.state);
    const value = view.hasValue ? preview(view.value, 26) : "";
    return [state, state === "" || view.state._tag === "Success" ? value : ""]
      .filter((part) => part !== "")
      .join(" · ");
  };
</script>

{#if graph.nodes.length === 0}
  <p class="empty">No atoms in this registry yet. Read one and it appears here.</p>
{:else}
  <svg
    class="graph"
    height={graph.height}
    role="img"
    aria-label="The registry's atoms and what reads what"
    viewBox="0 0 {graph.width} {graph.height}"
    width={graph.width}>
    {#each graph.nodes as node (node.view.id)}
      {#each node.parents as parentId (parentId)}
        {@const parent = byId.get(parentId)}
        {#if parent}
          <path
            class="edge"
            class:gone={!node.view.live}
            class:lit={selected === node.view.id || selected === parentId}
            d={edge(parent, node)} />
          {#key pulses(node.view)}
            {#if pulses(node.view) > 0}
              <path class="flow" d={edge(parent, node)} />
            {/if}
          {/key}
        {/if}
      {/each}
    {/each}

    {#each graph.nodes as node (node.view.id)}
      {@const view = node.view}
      <g
        class="node"
        class:gone={!view.live}
        class:selected={selected === view.id}
        class:plumbing={view.plumbing}
        style:transform="translate({node.x}px, {node.y}px)">
        <!-- The whole row is the target: name, note and mark. -->
        <rect
          class="hit"
          height="44"
          onclick={() => onselect(view.id)}
          onkeydown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onselect(view.id);
            }
          }}
          role="button"
          tabindex="0"
          aria-label="{view.name}: open its sheet"
          width={columnWidth - 30}
          x="-14"
          y="-22" />
        {#key pulses(view)}
          {#if pulses(view) > 0}
            <circle class="pulse" r="7" />
          {/if}
        {/key}
        {#each { length: Math.min(view.readers, 12) }, index (index)}
          {@const angle = -Math.PI / 2 + (index * Math.PI * 2) / Math.max(view.readers, 6)}
          <line
            class="reader"
            x1={Math.cos(angle) * 9}
            x2={Math.cos(angle) * 14}
            y1={Math.sin(angle) * 9}
            y2={Math.sin(angle) * 14} />
        {/each}
        {#if view.live}
          <circle
            class="dot"
            class:source={node.parents.length === 0}
            class:failure={view.state._tag === "Failure"}
            class:waiting={view.state._tag !== "Value" && view.state.waiting}
            r="5.5" />
        {:else}
          <path class="cross" d="M-5 -5 L5 5 M5 -5 L-5 5" />
        {/if}
        {#key crosses(view)}
          {#if crosses(view) > 0 && view.live}
            <path class="interrupt" d="M-8 -8 L8 8 M8 -8 L-8 8" />
          {/if}
        {/key}
        <text class="label" x="18" y="-2">{view.name}</text>
        <text class="note" x="18" y="14">{note(view)}</text>
      </g>
    {/each}
  </svg>
{/if}

<style>
  .empty {
    color: var(--muted);
    font-family: var(--serif);
    font-style: italic;
    margin: 0;
    padding: 2rem;
  }
  .graph {
    display: block;
    overflow: visible;
  }
  .edge {
    fill: none;
    stroke: var(--line);
    stroke-width: 1;
    transition: d 0.4s ease;
  }
  .edge.lit {
    stroke: var(--ink);
  }
  .edge.gone {
    stroke-dasharray: 3 4;
  }
  .flow {
    animation: flow 0.9s ease-out both;
    fill: none;
    stroke: var(--pulse);
    stroke-dasharray: 16 600;
    stroke-linecap: round;
    stroke-width: 2.5;
  }
  .node {
    transition:
      transform 0.4s ease,
      opacity 0.3s;
  }
  .node.plumbing .label {
    fill: var(--muted);
  }
  .node.gone {
    animation: fade 5s ease-in both;
  }
  .hit {
    cursor: pointer;
    fill: transparent;
  }
  .hit:focus-visible {
    outline: none;
    stroke: var(--ink);
    stroke-dasharray: 2 3;
  }
  .node.selected .hit {
    fill: var(--faint);
  }
  .dot {
    fill: var(--paper);
    stroke: var(--ink);
    stroke-width: 1.25;
  }
  .dot.source {
    fill: var(--ink);
  }
  .dot.failure {
    stroke: var(--alert);
    stroke-width: 2;
  }
  .dot.waiting {
    animation: spin 1.2s linear infinite;
    stroke-dasharray: 3 2.5;
  }
  .reader {
    stroke: var(--pulse);
    stroke-linecap: round;
    stroke-width: 1.5;
  }
  .pulse {
    animation: pulse 0.9s ease-out both;
    fill: none;
    stroke: var(--pulse);
    stroke-width: 2;
  }
  .cross,
  .interrupt {
    fill: none;
    stroke: var(--alert);
    stroke-width: 1.75;
  }
  .interrupt {
    animation: fade 4s ease-in both;
  }
  .label {
    fill: var(--ink);
    font-family: var(--mono);
    font-size: 12.5px;
  }
  .note {
    fill: var(--muted);
    font-family: var(--serif);
    font-size: 11.5px;
    font-style: italic;
  }
  .node.gone .note {
    fill: var(--alert);
  }
  @keyframes pulse {
    from {
      opacity: 1;
      r: 7;
    }
    to {
      opacity: 0;
      r: 26;
    }
  }
  @keyframes flow {
    from {
      stroke-dashoffset: 16;
    }
    to {
      stroke-dashoffset: -600;
    }
  }
  @keyframes fade {
    0%,
    60% {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }
  @keyframes spin {
    to {
      stroke-dashoffset: -11;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .pulse,
    .flow,
    .dot.waiting {
      animation-duration: 0.01s;
      animation-iteration-count: 1;
    }
    .node,
    .edge {
      transition: none;
    }
  }
</style>
