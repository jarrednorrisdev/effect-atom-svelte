<!--
  PROTOTYPE (landing hero variants, ?variant=a): throwaway, not for main.

  Variant A: the hero as sheet 1 of a technical drawing. The figure is this page's registry, live;
  the sheet's corners count what it holds. Once the hero scrolls away, the map docks as an inset so
  the examples below can be watched changing it.
-->
<script lang="ts">
  import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";
  import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
  import XIcon from "@lucide/svelte/icons/x";
  import { getRegistry } from "effect-atom-svelte";
  import { onMount } from "svelte";

  import { Button } from "#lib/components/ui/button/index.ts";
  import InstallCommand from "#lib/docs/install-command.svelte";
  import { rateAtom } from "#lib/landing/exchange-rate.ts";
  import { userAtom } from "#lib/landing/hero/user.ts";
  import { preferenceCookiesAtom } from "#lib/preferences.ts";

  import RegistryMap from "./registry-map.svelte";
  import { RegistryWatch } from "./registry-watch.svelte.ts";

  const { seeItRun }: { seeItRun: (event: MouseEvent) => void } = $props();

  const watch = new RegistryWatch(
    getRegistry(),
    new Map<unknown, string>([
      [rateAtom, "rateAtom"],
      [userAtom, "userAtom"],
      [preferenceCookiesAtom, "preferenceCookiesAtom"],
    ]),
    // The report example's atom is local to its component; it's made the same way as rateAtom.
    (read) => (read === String(rateAtom.read) ? "reportAtom" : undefined)
  );
  onMount(() => watch.start());

  const pad = (count: number) => String(count).padStart(2, "0");

  let scrollY = $state(0);
  let innerHeight = $state(800);
  let dismissed = $state(false);
  const docked = $derived(scrollY > innerHeight * 0.85 && !dismissed);
</script>

<svelte:window bind:innerHeight bind:scrollY />

<section class="plate border-b">
  <div class="sheet">
    <!-- The sheet's corners count what the registry holds, as you read. -->
    <span class="count tl">ATOMS <b>{pad(watch.live)}</b></span>
    <span class="count tr">READERS <b>{pad(watch.readers)}</b></span>
    <span class="count bl">UPDATES <b>{pad(watch.updates)}</b></span>
    <span class="count br">INTERRUPTED <b>{pad(watch.interrupted)}</b></span>
    <span aria-hidden="true" class="reg tl"></span>
    <span aria-hidden="true" class="reg tr"></span>
    <span aria-hidden="true" class="reg bl"></span>
    <span aria-hidden="true" class="reg br"></span>

    <header class="strip">
      <span>EFFECT-ATOM-SVELTE</span>
      <span class="hidden sm:inline">FIG. 1 · THE REGISTRY OF THIS PAGE</span>
      <span>SHEET 1 OF 5</span>
    </header>

    <div class="body">
      <div class="copy">
        <h1 class="text-[2.3rem] leading-[1.05] font-semibold tracking-tight sm:text-[2.6rem]">
          Write it in Effect.<br />
          <span class="text-brand-text">Read it in any component.</span>
        </h1>
        <p class="mt-5 max-w-lg text-lg text-pretty text-muted-foreground">
          Share the results of your Effect code across components: typed, cleaned up and
          refreshed, with no context or cache to write. Plus a typed client for your Effect backend.
        </p>

        <!-- Two lines of the real thing, called out like parts on a drawing. -->
        <div class="callouts mt-8">
          <div class="callout">
            <code>export const userAtom = Atom.make(currentUser)</code>
            <span aria-hidden="true" class="leader"></span>
            <span class="balloon">1</span>
          </div>
          <div class="callout">
            <code>const user = await useAtomResult(userAtom)</code>
            <span aria-hidden="true" class="leader"></span>
            <span class="balloon">2</span>
          </div>
          <ol class="legend">
            <li><span class="balloon">1</span> Defined once, in a plain module.</li>
            <li><span class="balloon">2</span> Read in any component. Every reader shares one run.</li>
          </ol>
        </div>

        <div class="mt-8 flex flex-wrap gap-3">
          <Button class="px-4" href="/introduction" size="lg">Get started <ArrowRightIcon /></Button>
          <Button class="px-4" href="#where-atoms-fit" onclick={seeItRun} size="lg" variant="outline">
            See it run <ArrowDownIcon />
          </Button>
        </div>
      </div>

      <figure class="figure">
        <div class="figure-map">
          <RegistryMap {watch} />
        </div>
        <figcaption>
          <b>Fig. 1.</b> Every atom this page is running, live. A filled dot is a source; a line
          runs to each atom derived from it; ticks are readers. Switch the package manager below,
          or use an example further down, and watch it change.
        </figcaption>
      </figure>
    </div>

    <footer class="title-block">
      <div class="cell install">
        <span class="key">INSTALL</span>
        <InstallCommand />
      </div>
      <div class="cell"><span class="key">PROJECT</span>effect-atom-svelte</div>
      <div class="cell"><span class="key">DRAWING</span>One Effect, read anywhere</div>
      <div class="cell"><span class="key">REV</span>0.x</div>
      <div class="cell"><span class="key">SCALE</span>1:1</div>
    </footer>
  </div>
</section>

{#if docked}
  <aside aria-label="This page's registry, live" class="inset">
    <header>
      <span>DETAIL A · REGISTRY, LIVE</span>
      <span class="tabular-nums">{pad(watch.live)} atoms · {pad(watch.readers)} readers</span>
      <button aria-label="Hide" onclick={() => (dismissed = true)} type="button">
        <XIcon class="size-3.5" />
      </button>
    </header>
    <div class="inset-map">
      <RegistryMap {watch} />
    </div>
  </aside>
{/if}

<style>
  .plate {
    padding: 2.25rem 1.5rem;
    --line: color-mix(in oklab, var(--foreground) 28%, transparent);
  }
  @media (width >= 64rem) {
    .plate {
      padding: 2rem 2.5rem 2.25rem;
    }
  }
  .sheet {
    border: 1px solid var(--line);
    display: grid;
    grid-template-rows: auto 1fr auto;
    margin: 0 auto;
    max-width: 88rem;
    position: relative;
    width: 100%;
    /* A ruler along the top and left edges, a tick every 1.5rem. */
    background-image:
      repeating-linear-gradient(to right, var(--line) 0 1px, transparent 1px 1.5rem),
      repeating-linear-gradient(to bottom, var(--line) 0 1px, transparent 1px 1.5rem);
    background-position:
      0 0,
      0 0;
    background-repeat: repeat-x, repeat-y;
    background-size:
      100% 6px,
      6px 100%;
  }
  .count {
    color: var(--muted-foreground);
    font-family: var(--font-mono);
    font-size: 0.68rem;
    letter-spacing: 0.08em;
    position: absolute;
    white-space: nowrap;
  }
  .count b {
    color: var(--foreground);
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  .count.tl {
    left: 0;
    bottom: calc(100% + 0.5rem);
  }
  .count.tr {
    right: 0;
    bottom: calc(100% + 0.5rem);
  }
  .count.bl {
    left: 0;
    top: calc(100% + 0.5rem);
  }
  .count.br {
    right: 0;
    top: calc(100% + 0.5rem);
  }
  /* Registration marks: a ring with a cross, just off each corner. */
  .reg {
    height: 18px;
    position: absolute;
    width: 18px;
    background:
      linear-gradient(var(--line), var(--line)) center / 1px 100% no-repeat,
      linear-gradient(var(--line), var(--line)) center / 100% 1px no-repeat;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1px var(--line);
  }
  .reg.tl {
    left: -9px;
    top: -9px;
  }
  .reg.tr {
    right: -9px;
    top: -9px;
  }
  .reg.bl {
    bottom: -9px;
    left: -9px;
  }
  .reg.br {
    bottom: -9px;
    right: -9px;
  }
  .strip {
    border-bottom: 1px solid var(--line);
    color: var(--muted-foreground);
    display: flex;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    justify-content: space-between;
    letter-spacing: 0.1em;
    padding: 0.6rem 1.25rem 0.5rem;
  }
  .body {
    display: grid;
  }
  @media (width >= 64rem) {
    .body {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
  }
  .copy {
    align-self: center;
    padding: 2.5rem 1.25rem;
  }
  @media (width >= 64rem) {
    .copy {
      padding: 2rem 2.5rem;
    }
  }
  .callouts {
    display: grid;
    gap: 0.4rem;
    max-width: 34rem;
  }
  .callout {
    align-items: center;
    display: flex;
    gap: 0.5rem;
  }
  .callout code {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    white-space: nowrap;
  }
  .leader {
    border-top: 1px dashed var(--line);
    flex: 1;
    min-width: 1rem;
  }
  .balloon {
    align-items: center;
    border: 1px solid var(--brand);
    border-radius: 50%;
    color: var(--brand-text);
    display: inline-flex;
    flex: none;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    height: 1.35rem;
    justify-content: center;
    width: 1.35rem;
  }
  .legend {
    color: var(--muted-foreground);
    display: grid;
    font-family: "Libron", ui-serif, Georgia, serif;
    font-size: 0.95rem;
    font-style: italic;
    gap: 0.3rem;
    margin-top: 0.75rem;
  }
  .legend li {
    align-items: center;
    display: flex;
    gap: 0.6rem;
  }
  .legend .balloon {
    font-style: normal;
  }
  .figure {
    border-top: 1px solid var(--line);
    display: grid;
    grid-template-rows: 1fr auto;
    margin: 0;
    min-height: 22rem;
  }
  @media (width >= 64rem) {
    .figure {
      border-left: 1px solid var(--line);
      border-top: 0;
    }
  }
  .figure-map {
    min-height: 0;
    padding: 1.5rem;
  }
  figcaption {
    border-top: 1px solid var(--line);
    color: var(--muted-foreground);
    font-family: "Libron", ui-serif, Georgia, serif;
    font-size: 0.95rem;
    font-style: italic;
    padding: 0.75rem 1.25rem;
  }
  figcaption b {
    color: var(--foreground);
    font-style: normal;
  }
  .title-block {
    border-top: 1px solid var(--line);
    display: grid;
    grid-template-columns: 1fr;
  }
  @media (width >= 64rem) {
    .title-block {
      grid-template-columns: minmax(0, 2.2fr) repeat(4, auto);
    }
  }
  .cell {
    align-items: baseline;
    border-top: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    font-size: 0.85rem;
    gap: 0.2rem;
    padding: 0.55rem 1.25rem 0.65rem;
  }
  @media (width >= 64rem) {
    .cell {
      border-left: 1px solid var(--line);
      border-top: 0;
    }
    .cell:first-child {
      border-left: 0;
    }
  }
  .cell.install {
    align-items: stretch;
  }
  .key {
    color: var(--muted-foreground);
    font-family: var(--font-mono);
    font-size: 0.62rem;
    letter-spacing: 0.1em;
  }
  .inset {
    background: var(--background);
    border: 1px solid color-mix(in oklab, var(--foreground) 28%, transparent);
    bottom: 1rem;
    box-shadow: 0 12px 32px -12px var(--code-shadow);
    display: grid;
    grid-template-rows: auto 1fr;
    height: 19rem;
    left: 1rem;
    position: fixed;
    width: 28rem;
    z-index: 40;
    animation: dock 0.35s cubic-bezier(0.2, 0.7, 0.2, 1) both;
  }
  .inset header {
    align-items: center;
    border-bottom: 1px solid color-mix(in oklab, var(--foreground) 28%, transparent);
    color: var(--muted-foreground);
    display: flex;
    font-family: var(--font-mono);
    font-size: 0.62rem;
    gap: 0.75rem;
    letter-spacing: 0.08em;
    padding: 0.4rem 0.4rem 0.4rem 0.75rem;
  }
  .inset header span:first-child {
    flex: 1;
  }
  .inset button {
    border-radius: var(--radius-sm);
    padding: 0.2rem;
  }
  .inset button:hover {
    background: var(--muted);
  }
  .inset-map {
    min-height: 0;
    padding: 0.5rem;
  }
  /* The inset draws the same map smaller; its text is scaled back up so it stays readable. */
  .inset-map :global(.label) {
    font-size: 24px;
  }
  .inset-map :global(.note) {
    font-size: 20px;
  }
  @keyframes dock {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
  }
</style>
