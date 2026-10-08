<!--
  @component
  A live dependency graph: lays out its `graph` (layout.ts) and draws it on a frame's lines
  (frame-graph.svelte), with a family's or factory's atoms as a row of dots. Call `pulse` when an
  atom's value updates and `interrupt` when its effect is interrupted, from outside any update of
  the registry's (on the next animation frame, say): the graph animates them on its own elements,
  with no Svelte state.

  ```svelte
  <script lang="ts">
    import { AtomGraph } from "effect-atom-svelte-devtools/graph";

    let graph: AtomGraph;
  </script>

  <AtomGraph bind:this={graph} graph={{ atoms, links, readers }} />
  ```

  Then, as values change: `graph.pulse(id, "success")`.
-->
<script lang="ts">
  import FrameGraph from "./frame-graph.svelte";
  import { layoutGraph } from "./layout.ts";
  import type { GraphInput, GraphLayout } from "./layout.ts";

  interface Props {
    readonly graph: GraphInput;
    /** Called with an atom's id when it's clicked; atoms are only clickable when this is given. */
    readonly onselect?: ((id: number) => void) | undefined;
    /** The atom to mark as selected. */
    readonly selected?: number | undefined;
    /** Shown in place of the graph while there's nothing to draw. */
    readonly empty?: string | undefined;
  }

  const { empty, graph, onselect, selected }: Props = $props();

  // For the gaps at crossings, which are a few pixels wide whatever the graph's width.
  let width = $state(0);
  let host = $state<HTMLElement>();

  const layout: GraphLayout | undefined = $derived(layoutGraph(graph, width));

  /** Restarts a class's animation on an element. */
  const replay = (element: HTMLElement, name: string) => {
    element.classList.remove(name);
    // Reading layout makes the browser see the class come off before it goes back on.
    void element.offsetWidth;
    element.classList.add(name);
  };

  /**
   * Rings an atom whose value updated, and flashes the edges into it, in the tone of what it
   * brought: `success` green, `failure` red, or the accent.
   */
  export const pulse = (id: number, tone: "success" | "failure" | "" = "") => {
    const mark = host?.querySelector<HTMLElement>(`[data-node="a${id}"]`);
    if (mark) {
      mark.dataset.tone = tone;
      replay(mark, "pulse");
    }
    for (const edge of host?.querySelectorAll<HTMLElement>(`[data-to="a${id}"]`) ?? []) {
      edge.dataset.tone = tone;
      replay(edge, "flash");
    }
  };

  /** Flashes a cross on an atom whose effect was interrupted. */
  export const interrupt = (id: number) => {
    const mark = host?.querySelector<HTMLElement>(`[data-node="a${id}"]`);
    if (mark) {
      replay(mark, "interrupted");
    }
  };

  const click = (event: MouseEvent) => {
    const target = (event.target as Element | null)?.closest<HTMLElement>("[data-node]");
    const id = target?.dataset.node;
    if (onselect && id?.startsWith("a")) {
      onselect(Number(id.slice(1)));
    }
  };

  $effect(() => {
    for (const element of host?.querySelectorAll("[data-node].selected") ?? []) {
      element.classList.remove("selected");
    }
    if (selected !== undefined) {
      host?.querySelector(`[data-node="a${selected}"]`)?.classList.add("selected");
    }
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
  bind:clientWidth={width}
  bind:this={host}
  style:height={layout ? `${layout.height}px` : undefined}
  class="atom-graph"
  class:interactive={onselect !== undefined}
  onclick={onselect ? click : undefined}
>
  {#if layout}
    <FrameGraph edges={layout.edges} interactive={onselect !== undefined} nodes={layout.nodes} />
    {#each layout.dots as row, index (index)}
      {#each row.dots as dot (dot.id)}
        <span
          style:left="{dot.x * width}px"
          style:top="{dot.y}px"
          class={["dot", dot.read && "read", dot.repeat && "repeat", dot.removed && "removed"]}
          data-node="a{dot.id}"
          title={dot.label}
        >
          <i></i>
          <b class="ring"></b>
          {#if row.keys}<span class="key">{dot.key}</span>{/if}
        </span>
      {/each}
    {/each}
  {:else if empty}
    <p class="empty">{empty}</p>
  {/if}
</div>

<style>
  .atom-graph {
    min-height: 3.5rem;
    position: relative;
  }
  .empty {
    bottom: 1rem;
    color: var(--muted-foreground, #52525b);
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.7rem;
    left: 1.5rem;
    letter-spacing: 0.08em;
    margin: 0;
    position: absolute;
    text-transform: uppercase;
  }
  /*
   * A family's or factory's atoms as dots on its track: hollow while held with no readers, filled
   * while read, crossed once removed, and red when it's a second atom for a key already seen. Odd
   * sizes and whole-pixel borders keep a dot centred on its 1px line (frame-graph.svelte).
   */
  .dot {
    --pulse: var(--brand, #d97706);
    height: 1px;
    position: absolute;
    width: 1px;
    z-index: 3;
  }
  .interactive .dot {
    cursor: pointer;
  }
  .dot:global([data-tone="success"]) {
    --pulse: var(--tone-success, #16a34a);
  }
  .dot:global([data-tone="failure"]) {
    --pulse: var(--tone-failure, #dc2626);
  }
  .dot i {
    background: var(--graph-background, var(--background, #fff));
    border: 2px solid var(--brand, #d97706);
    border-radius: 50%;
    height: 11px;
    left: -5px;
    position: absolute;
    top: -5px;
    width: 11px;
  }
  .dot.read i {
    background: var(--brand, #d97706);
  }
  .dot.repeat i {
    border-color: var(--tone-failure, #dc2626);
  }
  .dot.repeat.read i {
    background: var(--tone-failure, #dc2626);
  }
  .dot.removed i {
    background:
      linear-gradient(45deg, transparent 42%, var(--brand-text, #b45309) 42% 58%, transparent 58%),
      linear-gradient(-45deg, transparent 42%, var(--brand-text, #b45309) 42% 58%, transparent 58%);
    border: 0;
  }
  .dot:global(.pulse) i {
    animation: dot-mark 0.9s ease-out;
  }
  .dot:global(.selected) i {
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--brand, #d97706) 40%, transparent);
  }
  .key {
    color: var(--muted-foreground, #52525b);
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.62rem;
    left: 0;
    position: absolute;
    top: 0.6rem;
    translate: -50% 0;
    white-space: nowrap;
  }
  .dot.read .key {
    color: var(--brand-text, #b45309);
  }
  .dot.repeat .key {
    color: var(--tone-failure-text, var(--tone-failure, #dc2626));
  }
  .dot .ring {
    border: 1.5px solid var(--pulse);
    border-radius: 50%;
    height: 11px;
    left: -5px;
    opacity: 0;
    position: absolute;
    top: -5px;
    width: 11px;
  }
  .dot:global(.pulse) .ring {
    animation: dot-ring 0.9s ease-out both;
  }
  @keyframes dot-mark {
    from {
      background: var(--pulse);
      border-color: var(--pulse);
    }
  }
  @keyframes dot-ring {
    from {
      opacity: 1;
      scale: 1;
    }
    to {
      opacity: 0;
      scale: 2.6;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .dot:global(.pulse) i,
    .dot:global(.pulse) .ring {
      animation-duration: 0.01s;
    }
  }
</style>
