<!--
  PROTOTYPE (landing hero variants, ?variant=): throwaway, not for main.

  The live map: every atom in this page's registry, an edge from each atom to what derives from
  it, a tick per reader, a pulse when its value changes, and a cross when it is interrupted.
-->
<script lang="ts">
  import { height, width } from "./registry-watch.svelte.ts";
  import type { RegistryWatch } from "./registry-watch.svelte.ts";

  const { watch, labels = true }: { watch: RegistryWatch; labels?: boolean } = $props();

  const lookup = $derived(new Map(watch.nodes.map((node) => [node.id, node])));

  // The layout moves nodes every frame; that goes straight to the SVG, not through Svelte's state.
  let svg = $state<SVGSVGElement>();
  $effect(() =>
    watch.onFrame((nodes) => {
      if (!svg) {
        return;
      }
      const at = new Map(nodes.map((node) => [String(node.id), node]));
      for (const element of svg.querySelectorAll<SVGGElement>("[data-node]")) {
        const node = at.get(element.dataset.node!);
        if (node) {
          element.setAttribute("transform", `translate(${node.x} ${node.y})`);
        }
      }
      for (const element of svg.querySelectorAll<SVGLineElement>("[data-from]")) {
        const from = at.get(element.dataset.from!);
        const to = at.get(element.dataset.to!);
        if (from && to) {
          element.setAttribute("x1", String(from.x));
          element.setAttribute("y1", String(from.y));
          element.setAttribute("x2", String(to.x));
          element.setAttribute("y2", String(to.y));
        }
      }
    })
  );
</script>

<svg bind:this={svg} aria-hidden="true" class="map" preserveAspectRatio="xMidYMid meet" viewBox="0 0 {width} {height}">
  {#each watch.nodes as node (node.id)}
    {#each node.parents as parentId (parentId)}
      {@const parent = lookup.get(parentId)}
      {#if parent}
        <line data-from={parent.id} data-to={node.id} class="edge" class:gone={node.goneAt !== undefined} x1={parent.x} x2={node.x} y1={parent.y} y2={node.y} />
        {#key node.pulses}
          {#if node.pulses > 0}
            <line data-from={parent.id} data-to={node.id} class="flow" x1={parent.x} x2={node.x} y1={parent.y} y2={node.y} />
          {/if}
        {/key}
      {/if}
    {/each}
  {/each}

  {#each watch.nodes as node (node.id)}
    <g data-node={node.id} class="node" class:gone={node.goneAt !== undefined} transform="translate({node.x} {node.y})">
      {#key node.pulses}
        {#if node.pulses > 0}
          <circle class="pulse" r="6" />
        {/if}
      {/key}
      {#each { length: Math.min(node.readers, 12) }, index (index)}
        {@const angle = -Math.PI / 2 + (index * Math.PI * 2) / Math.max(node.readers, 6)}
        <line
          class="reader"
          x1={Math.cos(angle) * 9}
          x2={Math.cos(angle) * 14}
          y1={Math.sin(angle) * 9}
          y2={Math.sin(angle) * 14}
        />
      {/each}
      {#if node.goneAt === undefined}
        <circle class="dot" class:source={node.parents.length === 0} r="5" />
      {:else}
        <path class="cross" d="M-5 -5 L5 5 M5 -5 L-5 5" />
      {/if}
      {#if labels}
        <text class="label" x="18" y="4">{node.name}</text>
        {#if node.goneAt !== undefined}
          <text class="note" x="18" y="23">interrupted · finalizers ran</text>
        {:else if node.readers > 0}
          <text class="note quiet" x="18" y="23">{node.readers} {node.readers === 1 ? "reader" : "readers"}</text>
        {/if}
      {/if}
    </g>
  {/each}
</svg>

<style>
  .map {
    display: block;
    height: 100%;
    overflow: visible;
    width: 100%;
  }
  .edge {
    stroke: var(--border-strong);
    stroke-width: 1;
  }
  .edge.gone {
    stroke-dasharray: 3 4;
  }
  .flow {
    animation: flow 0.9s ease-out both;
    stroke: var(--brand);
    stroke-dasharray: 14 400;
    stroke-linecap: round;
    stroke-width: 2.5;
  }
  .dot {
    fill: var(--background);
    stroke: var(--foreground);
    stroke-width: 1.25;
  }
  .dot.source {
    fill: var(--foreground);
  }
  .reader {
    stroke: var(--brand);
    stroke-linecap: round;
    stroke-width: 1.5;
  }
  .pulse {
    animation: pulse 0.9s ease-out both;
    fill: none;
    stroke: var(--brand);
    stroke-width: 2;
  }
  .cross {
    stroke: var(--brand-text);
    stroke-width: 1.5;
  }
  .label {
    fill: var(--foreground);
    font-family: var(--font-mono);
    font-size: 17px;
  }
  .note {
    fill: var(--brand-text);
    font-family: "Libron", ui-serif, Georgia, serif;
    font-size: 15px;
    font-style: italic;
  }
  .note.quiet {
    fill: var(--muted-foreground);
  }
  .node {
    transition: opacity 0.4s;
  }
  .node.gone {
    animation: fade 5s ease-in both;
  }
  @keyframes pulse {
    from {
      opacity: 1;
      r: 6;
    }
    to {
      opacity: 0;
      r: 26;
    }
  }
  @keyframes flow {
    from {
      stroke-dashoffset: 14;
    }
    to {
      stroke-dashoffset: -400;
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
  @media (prefers-reduced-motion: reduce) {
    .pulse,
    .flow {
      animation-duration: 0.01s;
    }
  }
</style>
