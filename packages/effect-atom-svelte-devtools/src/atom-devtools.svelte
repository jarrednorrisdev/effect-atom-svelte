<!--
  @component
  A floating panel that shows the atom registry live: its dependency graph, a sheet per atom and a
  timeline of everything it does. Development only: in a production build, or on the server, it
  renders nothing.

  It follows the registry of the nearest `RegistryProvider`, or the one given as `registry`. When
  the app has several, a picker in the panel switches between them.

  Render it only in development, behind Vite's `DEV` flag, so a build leaves it out: the README
  shows how.
-->
<script lang="ts">
  import { BROWSER, DEV } from "esm-env";
  import type { AtomRegistry } from "effect/reactivity";
  import { getRegistry } from "effect-atom-svelte";
  import { inspect, watchRegistries } from "effect-atom-svelte/inspector";
  import { onMount } from "svelte";

  import GraphView from "./internal/graph-view.svelte";
  import { Model } from "./internal/model.svelte.ts";
  import SheetsView from "./internal/sheets-view.svelte";
  import TimelineView from "./internal/timeline-view.svelte";

  interface Props {
    /** The registry to show. Defaults to the nearest `RegistryProvider`'s. */
    readonly registry?: AtomRegistry.AtomRegistry | undefined;
    /** Whether the panel starts open. Defaults to how it was left. */
    readonly open?: boolean | undefined;
    /** Light paper, a dark blueprint, or the page's own (`auto`: a `dark` class on `<html>`, or the system's). */
    readonly theme?: "auto" | "light" | "dark" | undefined;
  }

  const { registry, open: startOpen, theme = "auto" }: Props = $props();

  type Tab = "graph" | "sheets" | "timeline";
  interface Saved {
    readonly open: boolean;
    readonly tab: Tab;
    readonly plumbing: boolean;
    readonly expanded: boolean;
  }
  const storageKey = "effect-atom-svelte-devtools";
  const load = (): Partial<Saved> => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? "{}") as Partial<Saved>;
    } catch {
      return {};
    }
  };

  const enabled = DEV && BROWSER;
  // The registry in context, read while the component sets up, as context must be.
  // svelte-ignore state_referenced_locally
  const nearest = enabled ? (registry ?? getRegistry()) : undefined;

  let mounted = $state(false);
  let open = $state(false);
  let tab = $state<Tab>("graph");
  let showPlumbing = $state(false);
  let expanded = $state(false);
  let selected = $state<number>();
  let dark = $state(false);
  let registries = $state.raw<readonly AtomRegistry.AtomRegistry[]>([]);
  let chosen = $state.raw<AtomRegistry.AtomRegistry | undefined>(nearest);
  let model = $state.raw<Model>();

  onMount(() => {
    const saved = load();
    open = startOpen ?? saved.open ?? false;
    tab = saved.tab ?? "graph";
    showPlumbing = saved.plumbing ?? false;
    expanded = saved.expanded ?? false;
    mounted = true;

    const stopWatching = watchRegistries((list) => {
      registries = list;
      if (chosen === undefined || !list.includes(chosen)) {
        chosen = nearest !== undefined && list.includes(nearest) ? nearest : (list[0] ?? nearest);
      }
    });

    // The page's theme: a `dark` or `light` class on <html>, or the system's.
    const root = document.documentElement;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const readTheme = () => {
      dark =
        theme === "dark" ||
        (theme === "auto" &&
          (root.classList.contains("dark") ||
            (!root.classList.contains("light") && media.matches)));
    };
    readTheme();
    const observer = new MutationObserver(readTheme);
    observer.observe(root, { attributeFilter: ["class"], attributes: true });
    media.addEventListener("change", readTheme);
    return () => {
      stopWatching();
      observer.disconnect();
      media.removeEventListener("change", readTheme);
    };
  });

  // One model per registry shown, following it from the moment it is chosen, open or not, so the
  // timeline has the page's history when the panel opens.
  $effect(() => {
    if (!enabled || chosen === undefined) {
      return;
    }
    const next = new Model(inspect(chosen));
    model = next;
    selected = undefined;
    return next.start();
  });

  $effect(() => {
    if (!mounted) {
      return;
    }
    const saved: Saved = { expanded, open, plumbing: showPlumbing, tab };
    try {
      localStorage.setItem(storageKey, JSON.stringify(saved));
    } catch {
      // Storage may be full or turned off; the panel then starts as it starts.
    }
  });

  const select = (id: number | undefined) => {
    selected = id;
    tab = "sheets";
  };
  const registryName = (index: number) => (index === 0 ? "registry 1" : `registry ${index + 1}`);
  const tabs: readonly { readonly id: Tab; readonly label: string; readonly figure: string }[] = [
    { figure: "FIG. 1", id: "graph", label: "GRAPH" },
    { figure: "SET", id: "sheets", label: "SHEETS" },
    { figure: "LOG", id: "timeline", label: "TIMELINE" },
  ];
</script>

{#if enabled && mounted && model}
  <div class="devtools" class:dark>
    {#if open}
      <div
        aria-label="Atom devtools"
        class="panel"
        class:expanded
        onkeydown={(event) => {
          if (event.key === "Escape") {
            open = false;
          }
        }}
        role="dialog"
        tabindex="-1">
        <header class="strip">
          <span class="title">EFFECT-ATOM-SVELTE · DEVTOOLS</span>
          <nav aria-label="Views" class="tabs">
            {#each tabs as item (item.id)}
              <button aria-pressed={tab === item.id} class="tab" onclick={() => (tab = item.id)} type="button">
                <span class="figure">{item.figure}</span>
                {item.label}
              </button>
            {/each}
          </nav>
          <span class="spacer"></span>
          {#if registries.length > 1}
            <select
              aria-label="Registry"
              class="picker"
              onchange={(event) => (chosen = registries[Number(event.currentTarget.value)])}
              value={String(registries.indexOf(chosen as AtomRegistry.AtomRegistry))}>
              {#each registries as item, index (item)}
                <option value={String(index)}>{registryName(index)}{item === nearest ? " (this one)" : ""}</option>
              {/each}
            </select>
          {/if}
          <label class="toggle">
            <input bind:checked={showPlumbing} type="checkbox" />
            plumbing
          </label>
          <button aria-label={expanded ? "Shrink the panel" : "Enlarge the panel"} class="icon" onclick={() => (expanded = !expanded)} title={expanded ? "Shrink" : "Enlarge"} type="button">
            {expanded ? "▣" : "□"}
          </button>
          <button aria-label="Close the panel" class="icon" onclick={() => (open = false)} title="Close (Esc)" type="button">✕</button>
        </header>

        {#if model.partial}
          <p class="notice">
            This registry isn't the one effect-atom-svelte's inspector was written for (a newer Effect?), so only atoms added and removed are shown.
          </p>
        {:else if model.unlabelled}
          <p class="notice">
            No atom has a name. Add <code>atomLabels()</code> from <code>effect-atom-svelte-devtools/vite</code> to your Vite config to name them after their variables.
          </p>
        {/if}

        <div class="body">
          {#if tab === "graph"}
            <div class="scroll">
              <GraphView atoms={model.atoms} onselect={select} {selected} {showPlumbing} />
            </div>
          {:else if tab === "sheets"}
            <SheetsView {model} onselect={select} {selected} {showPlumbing} />
          {:else}
            <TimelineView {model} onselect={select} {showPlumbing} />
          {/if}
        </div>

        <footer class="corners">
          <span>ATOMS <b>{String(model.totals.atoms).padStart(2, "0")}</b></span>
          <span>READERS <b>{String(model.totals.readers).padStart(2, "0")}</b></span>
          <span>UPDATES <b>{String(model.totals.updates).padStart(2, "0")}</b></span>
          <span>INTERRUPTED <b>{String(model.totals.interruptions).padStart(2, "0")}</b></span>
        </footer>
      </div>
    {:else}
      <button aria-label="Open the atom devtools" class="launcher" onclick={() => (open = true)} type="button">
        <svg aria-hidden="true" height="14" viewBox="-8 -8 16 16" width="14">
          <circle cx="0" cy="0" fill="none" r="4" stroke="currentColor" stroke-width="1.5" />
          <path d="M0 -7 V-5 M0 5 V7 M-7 0 H-5 M5 0 H7" stroke="currentColor" stroke-width="1.5" />
        </svg>
        ATOMS <b>{String(model.totals.atoms).padStart(2, "0")}</b>
      </button>
    {/if}
  </div>
{/if}

<style>
  .devtools {
    --paper: #f8f6f0;
    --ink: #1d2433;
    --muted: #5f6878;
    --line: rgb(29 36 51 / 0.28);
    --faint: rgb(29 36 51 / 0.07);
    --pulse: #1f5fd6;
    --alert: #c2410c;
    --mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;
    --serif: ui-serif, Georgia, "Times New Roman", serif;
    color: var(--ink);
    font-family: var(--mono);
    font-size: 13px;
    line-height: 1.4;
  }
  /* A blueprint. */
  .devtools.dark {
    --paper: #0f2140;
    --ink: #e5edf8;
    --muted: #9db0cb;
    --line: rgb(229 237 248 / 0.3);
    --faint: rgb(229 237 248 / 0.08);
    --pulse: #7cc8ff;
    --alert: #ff9b73;
  }
  .devtools :global(*) {
    box-sizing: border-box;
  }
  .launcher {
    align-items: center;
    background: var(--paper);
    border: 1px solid var(--line);
    bottom: 16px;
    box-shadow: 0 8px 24px -12px rgb(0 0 0 / 0.5);
    color: var(--ink);
    cursor: pointer;
    display: inline-flex;
    font-family: var(--mono);
    font-size: 11px;
    gap: 0.45rem;
    letter-spacing: 0.08em;
    padding: 0.4rem 0.7rem;
    position: fixed;
    right: 16px;
    z-index: 2147483000;
  }
  .launcher b {
    font-variant-numeric: tabular-nums;
  }
  .panel {
    /* The paper, with a ruler along its top and left edges. */
    background-color: var(--paper);
    background-image:
      repeating-linear-gradient(to right, var(--line) 0 1px, transparent 1px 24px),
      repeating-linear-gradient(to bottom, var(--line) 0 1px, transparent 1px 24px);
    background-repeat: repeat-x, repeat-y;
    background-size:
      100% 5px,
      5px 100%;
    border: 1px solid var(--line);
    bottom: 16px;
    box-shadow: 0 18px 48px -18px rgb(0 0 0 / 0.55);
    display: flex;
    flex-direction: column;
    height: min(70vh, 640px);
    position: fixed;
    right: 16px;
    width: min(1040px, calc(100vw - 32px));
    z-index: 2147483000;
    animation: rise 0.25s cubic-bezier(0.2, 0.7, 0.2, 1) both;
  }
  .panel.expanded {
    height: calc(100vh - 32px);
    width: calc(100vw - 32px);
  }
  .strip {
    align-items: center;
    border-bottom: 1px solid var(--line);
    display: flex;
    font-size: 10.5px;
    gap: 0.75rem;
    letter-spacing: 0.1em;
    padding: 0.35rem 0.4rem 0.35rem 0.9rem;
  }
  .title {
    color: var(--muted);
    white-space: nowrap;
  }
  .tabs {
    display: flex;
    gap: 0.25rem;
  }
  .tab {
    background: none;
    border: 1px solid transparent;
    color: var(--muted);
    cursor: pointer;
    font: inherit;
    letter-spacing: inherit;
    padding: 0.2rem 0.55rem;
  }
  .tab[aria-pressed="true"] {
    border-color: var(--line);
    color: var(--ink);
  }
  .figure {
    color: var(--muted);
    margin-right: 0.3rem;
  }
  .spacer {
    flex: 1;
  }
  .picker {
    background: var(--paper);
    border: 1px solid var(--line);
    color: var(--ink);
    font: inherit;
    padding: 0.1rem 0.25rem;
  }
  .toggle {
    align-items: center;
    color: var(--muted);
    display: inline-flex;
    gap: 0.3rem;
    white-space: nowrap;
  }
  .toggle input {
    accent-color: var(--ink);
    margin: 0;
  }
  .icon {
    background: none;
    border: 0;
    color: var(--ink);
    cursor: pointer;
    font-size: 13px;
    line-height: 1;
    padding: 0.25rem 0.4rem;
  }
  .icon:hover,
  .tab:hover {
    background: var(--faint);
  }
  .notice {
    border-bottom: 1px solid var(--line);
    color: var(--muted);
    font-family: var(--serif);
    font-style: italic;
    margin: 0;
    padding: 0.45rem 0.9rem;
  }
  .notice code {
    font-family: var(--mono);
    font-style: normal;
  }
  .body {
    flex: 1;
    min-height: 0;
  }
  .scroll {
    height: 100%;
    overflow: auto;
    padding: 0.5rem 1rem 1rem 1.25rem;
  }
  .corners {
    border-top: 1px solid var(--line);
    color: var(--muted);
    display: flex;
    font-size: 10px;
    gap: 1.5rem;
    justify-content: space-between;
    letter-spacing: 0.08em;
    padding: 0.35rem 0.9rem;
  }
  .corners b {
    color: var(--ink);
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .panel {
      animation: none;
    }
  }
</style>
