<!--
  @component
  The landing page's hero: a grid of cells ruled in hairlines that run off the page's edges, with a
  cross wherever two lines meet, and a dependency graph drawn on its own lines. An Effect sits on
  one cross, the atom on the centre cross, and the three components that read it on the others.
  The page's rails carry its sides on down the page (routes/+page.svelte, .rails), and the site
  header draws the crosses on its top line (lib/docs/site-header.svelte).

  ```svelte
  <HeroFrame copy={heroCopy} panel={heroPanel} {seeItRun} />
  ```
-->
<script lang="ts">
  import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";
  import type { Snippet } from "svelte";

  import { FrameGraph } from "effect-atom-svelte-devtools/graph";
  import type { GraphEdge, GraphNode } from "effect-atom-svelte-devtools/graph";

  const {
    copy,
    panel,
    seeItRun,
  }: {
    copy: Snippet;
    panel: Snippet;
    seeItRun: (event: MouseEvent) => void;
  } = $props();

  // Where the lines are: the top of the main row, and its bottom. contentRect keeps fractions of a
  // pixel, which offsetHeight would round away.
  let labelsRect = $state<DOMRectReadOnly>();
  let mainRect = $state<DOMRectReadOnly>();
  const top = $derived(labelsRect?.height ?? 0);
  const bottom = $derived(top + (mainRect?.height ?? 0));

  const nodes = $derived<GraphNode[]>([
    { kind: "effect", label: "currentUser", note: "an Effect<User, SignedOut>", side: "se", x: 0, y: top },
    { kind: "atom", label: "userAtom", note: "runs it once for every reader", side: "se", step: 1, x: 0.5, y: top },
    { kind: "component", label: "SiteHeader.svelte", side: "sw", step: 2, x: 1, y: top },
    { kind: "junction", step: 2, x: 0.5, y: bottom },
    { kind: "component", label: "UserBadge.svelte", side: "ne", step: 3, x: 0, y: bottom },
    { kind: "component", label: "Settings.svelte", side: "nw", step: 3, x: 1, y: bottom },
  ]);
  const edges = $derived<GraphEdge[]>([
    { lit: true, points: [[0, top], [0.5, top]], step: 0 },
    { lit: true, points: [[0.5, top], [1, top]], step: 1 },
    { lit: true, points: [[0.5, top], [0.5, bottom]], step: 1 },
    { lit: true, points: [[0.5, bottom], [0, bottom]], step: 2 },
    { lit: true, points: [[0.5, bottom], [1, bottom]], step: 2 },
  ]);
</script>

<section class="frame-wrap">
<div class="frame">
  <!-- Row 1: labels. -->
  <div bind:contentRect={labelsRect} class="row labels">
    <div class="cell">
      <span aria-hidden="true">A</span><span>One Effect → one atom → every component that reads it</span>
    </div>
    <div class="cell hidden lg:flex">
      <span aria-hidden="true">B</span><span>When to reach for atoms</span>
    </div>
    <!-- No crosses: the site header draws them on its own bottom line, which this row sits under. -->
  </div>

  <!-- Row 2: the copy beside the panel. -->
  <div bind:contentRect={mainRect} class="row main">
    <div class="cell copy">{@render copy()}</div>
    <div class="cell panel">{@render panel()}</div>
    <i class="cross" style:left="-1px"></i>
    <i class="cross mid hidden lg:block"></i>
    <i class="cross" style:left="100%"></i>
  </div>

  <!-- Row 3: where to go next. -->
  <div class="row foot">
    <a class="cell next" href="#where-atoms-fit" onclick={seeItRun}>
      <span aria-hidden="true">01–04</span>Four reasons, each running on this page <ArrowDownIcon class="size-3.5" />
    </a>
    <div class="cell hidden lg:flex">
      <span aria-hidden="true">MIT</span>A community project · not made by the Effect team
    </div>
    <i class="cross" style:left="-1px"></i>
    <i class="cross mid hidden lg:block"></i>
    <i class="cross" style:left="100%"></i>
  </div>
  <div class="hidden lg:contents">
    <!-- The graph's box starts inside the frame's 1px side borders. -->
    <FrameGraph {edges} {nodes} origin={{ left: -1, right: 0, top: 0 }} />
  </div>
  <i class="cross end" style:left="-1px"></i>
  <i class="cross end mid hidden lg:block"></i>
  <i class="cross end" style:left="100%"></i>
</div>
</section>

<style>
  .frame-wrap {
    overflow-x: clip;
  }
  .frame {
    border-inline: 1px solid var(--line);
    /* The site's hairline colour, and its crosses' (app.css). */
    --line: var(--border);
    margin: 0 auto;
    max-width: 75rem;
    position: relative;
    width: calc(100% - 3rem);
  }
  @media (width >= 64rem) {
    .frame {
      width: calc(100% - 5rem);
      display: grid;
      grid-template-rows: auto 1fr auto;
      min-height: calc(100svh - 3.5rem);
    }
  }
  .row {
    display: grid;
    position: relative;
  }
  /* Each row's top line runs off both edges of the page. */
  .row::before {
    border-top: 1px solid var(--line);
    content: "";
    left: -100vw;
    position: absolute;
    right: -100vw;
    top: 0;
  }
  /* The site header's bottom border is the frame's top line, so the first row doesn't draw one;
     the header draws the crosses on it too (lib/docs/site-header.svelte). */
  .labels::before {
    display: none;
  }
  /* Placed from the top, like the end crosses, so both round onto the same pixels. */
  .frame::after {
    border-top: 1px solid var(--line);
    content: "";
    top: calc(100% - 1px);
    left: -100vw;
    position: absolute;
    right: -100vw;
  }
  @media (width >= 64rem) {
    .row {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
  }
  .cell {
    min-width: 0;
  }
  @media (width >= 64rem) {
    .cell + .cell {
      border-left: 1px solid var(--line);
    }
  }
  .labels .cell,
  .foot .cell {
    align-items: center;
    color: var(--muted-foreground);
    display: flex;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    gap: 0.9rem;
    letter-spacing: 0.04em;
    padding: 0.7rem 1.25rem;
  }
  .labels .cell span:first-child,
  .foot .cell span:first-child {
    color: var(--brand-text);
  }
  .next:hover {
    color: var(--foreground);
  }
  .main .copy {
    align-self: center;
    padding: 3.5rem 1.25rem;
  }
  .main .panel {
    padding: 2rem 1.25rem;
  }
  @media (width >= 64rem) {
    .main .copy {
      padding: 4rem 3rem 4rem 2.5rem;
    }
    .main .panel {
      align-self: stretch;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 2.5rem;
    }
  }
  /* A cross where a row's top line meets a column line. It's anchored on the 1px square where
     the lines cross, at the same CSS coordinates as they are, and its arms are 1px borders like
     theirs, so at any display scale the browser rounds it onto the same device pixels. */
  .cross {
    height: 1px;
    position: absolute;
    top: 0;
    width: 1px;
    z-index: 1;
  }
  .cross::before,
  .cross::after {
    content: "";
    position: absolute;
  }
  .cross::before {
    border-top: 1px solid var(--cross);
    left: -6px;
    top: 0;
    width: 13px;
  }
  .cross::after {
    border-left: 1px solid var(--cross);
    height: 13px;
    left: 0;
    top: -6px;
  }
  .cross.end {
    top: calc(100% - 1px);
  }
  .cross.mid {
    left: 50%;
  }
</style>
