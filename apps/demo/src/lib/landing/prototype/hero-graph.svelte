<!--
  PROTOTYPE (landing hero variants, ?variant=b): throwaway, not for main.

  Variant B: the current hero, with the glow and grid replaced by a still drawing of what an app
  built on atoms looks like: Effects feeding atoms, atoms feeding the components that read them.
  One path, an Effect read by three components, is drawn in the accent, the headline's claim.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  const { copy, panel }: { copy: Snippet; panel: Snippet } = $props();

  type Kind = "effect" | "atom" | "component";
  interface Point {
    readonly name: string;
    readonly kind: Kind;
    readonly x: number;
    readonly y: number;
  }
  interface Band {
    readonly points: Record<string, Point>;
    readonly edges: readonly (readonly [string, string, "lit"?])[];
  }

  const top: Band = {
    edges: [
      ["currentUser", "userAtom", "lit"],
      ["userAtom", "SiteHeader", "lit"],
      ["userAtom", "UserBadge", "lit"],
      ["userAtom", "Settings", "lit"],
      ["userAtom", "initialsAtom"],
      ["initialsAtom", "Avatar"],
      ["listTodos", "todosAtom"],
      ["todosAtom", "openCountAtom"],
      ["openCountAtom", "TodoBadge"],
      ["todosAtom", "TodoList"],
    ],
    points: {
      Avatar: { kind: "component", name: "Avatar.svelte", x: 900, y: 128 },
      Settings: { kind: "component", name: "Settings.svelte", x: 470, y: 128 },
      SiteHeader: { kind: "component", name: "SiteHeader.svelte", x: 470, y: 32 },
      TodoBadge: { kind: "component", name: "TodoBadge.svelte", x: 1330, y: 30 },
      TodoList: { kind: "component", name: "TodoList.svelte", x: 1330, y: 110 },
      UserBadge: { kind: "component", name: "UserBadge.svelte", x: 470, y: 80 },
      currentUser: { kind: "effect", name: "currentUser", x: 36, y: 80 },
      initialsAtom: { kind: "atom", name: "initialsAtom", x: 700, y: 128 },
      listTodos: { kind: "effect", name: "TodosRpc.listTodos", x: 760, y: 50 },
      openCountAtom: { kind: "atom", name: "openCountAtom", x: 1150, y: 30 },
      todosAtom: { kind: "atom", name: "todosAtom", x: 980, y: 70 },
      userAtom: { kind: "atom", name: "userAtom", x: 240, y: 80 },
    },
  };

  const bottom: Band = {
    edges: [
      ["fetchRate", "rateAtom"],
      ["rateAtom", "Header"],
      ["rateAtom", "priceAtom"],
      ["priceAtom", "Checkout"],
      ["priceAtom", "Cart"],
      ["clock", "nowAtom"],
      ["nowAtom", "Countdown"],
      ["rateAtom", "chartAtom"],
      ["nowAtom", "chartAtom"],
      ["chartAtom", "RateChart"],
    ],
    points: {
      Cart: { kind: "component", name: "Cart.svelte", x: 680, y: 120 },
      Checkout: { kind: "component", name: "Checkout.svelte", x: 680, y: 72 },
      Countdown: { kind: "component", name: "Countdown.svelte", x: 1330, y: 120 },
      Header: { kind: "component", name: "Header.svelte", x: 470, y: 24 },
      RateChart: { kind: "component", name: "RateChart.svelte", x: 1330, y: 40 },
      chartAtom: { kind: "atom", name: "chartAtom", x: 1120, y: 40 },
      clock: { kind: "effect", name: "Stream.tick", x: 880, y: 120 },
      fetchRate: { kind: "effect", name: "fetchRate", x: 36, y: 72 },
      nowAtom: { kind: "atom", name: "nowAtom", x: 1090, y: 120 },
      priceAtom: { kind: "atom", name: "priceAtom", x: 470, y: 96 },
      rateAtom: { kind: "atom", name: "rateAtom", x: 240, y: 72 },
    },
  };

  const curve = (a: Point, b: Point) => {
    const mid = (a.x + b.x) / 2;
    return `M${a.x} ${a.y} C${mid} ${a.y} ${mid} ${b.y} ${b.x} ${b.y}`;
  };
</script>

{#snippet band(data: Band, where: "top" | "bottom")}
  <svg aria-hidden="true" class="band {where}" preserveAspectRatio="xMidYMid meet" viewBox="0 0 1440 160">
    {#each data.edges as [from, to, lit] (`${from}-${to}`)}
      <path class={["edge", lit && "lit"]} d={curve(data.points[from]!, data.points[to]!)} pathLength="1" />
    {/each}
    {#each Object.values(data.points) as point (point.name)}
      <g class={["point", point.kind]} transform="translate({point.x} {point.y})">
        {#if point.kind === "effect"}
          <rect height="8" transform="rotate(45)" width="8" x="-4" y="-4" />
        {:else if point.kind === "atom"}
          <circle r="4.5" />
        {:else}
          <rect height="9" rx="1.5" width="9" x="-4.5" y="-4.5" />
        {/if}
        <text x="10" y="-8">{point.name}</text>
      </g>
    {/each}
  </svg>
{/snippet}

<section class="hero relative overflow-hidden border-b">
  {@render band(top, "top")}
  {@render band(bottom, "bottom")}
  <p class="legend" aria-hidden="true">
    <span><i class="effect"></i>Effect</span>
    <span><i class="atom"></i>atom</span>
    <span><i class="component"></i>component</span>
  </p>
  <div
    class="mx-auto grid w-full max-w-7xl items-center gap-12 px-6 py-16 lg:min-h-[calc(100svh-3.5rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:px-10 lg:py-44"
  >
    <div class="min-w-0">{@render copy()}</div>
    <div class="min-w-0">{@render panel()}</div>
  </div>
</section>

<style>
  .band {
    left: 50%;
    max-width: 110rem;
    pointer-events: none;
    position: absolute;
    transform: translateX(-50%);
    width: 100%;
  }
  .band.top {
    top: 0.5rem;
  }
  .band.bottom {
    bottom: 0.5rem;
  }
  /* The bands fade out under the hero panel's side, so they frame the copy rather than compete. */
  .band {
    mask-image: linear-gradient(to right, black 55%, transparent 98%);
  }
  .edge {
    fill: none;
    stroke: var(--border-strong);
    stroke-width: 1;
  }
  .edge.lit {
    stroke: var(--brand);
    stroke-width: 1.5;
  }
  .point text {
    fill: var(--muted-foreground);
    font-family: var(--font-mono);
    font-size: 11px;
  }
  .point circle,
  .point rect {
    fill: var(--background);
    stroke: var(--subtle-foreground);
    stroke-width: 1.25;
  }
  .point.effect rect {
    fill: var(--subtle-foreground);
  }
  .top .point:nth-child(-n + 16) text {
    fill: var(--muted-foreground);
  }
  .legend {
    bottom: 0.75rem;
    color: var(--muted-foreground);
    display: none;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    gap: 1rem;
    position: absolute;
    right: 1.5rem;
  }
  @media (width >= 64rem) {
    .legend {
      display: flex;
    }
  }
  .legend span {
    align-items: center;
    display: inline-flex;
    gap: 0.4rem;
  }
  .legend i {
    border: 1.25px solid var(--subtle-foreground);
    display: inline-block;
    height: 8px;
    width: 8px;
  }
  .legend .effect {
    background: var(--subtle-foreground);
    transform: rotate(45deg) scale(0.85);
  }
  .legend .atom {
    border-radius: 50%;
  }
  .legend .component {
    border-radius: 1.5px;
  }
  .hero > div {
    position: relative;
  }
  /* The lit path draws itself in once, from the Effect out to its readers. */
  @media (prefers-reduced-motion: no-preference) {
    .edge.lit {
      animation: draw 1.4s cubic-bezier(0.3, 0.6, 0.2, 1) 0.4s both;
      stroke-dasharray: 1;
    }
  }
  @keyframes draw {
    from {
      stroke-dashoffset: 1;
    }
    to {
      stroke-dashoffset: 0;
    }
  }
</style>
