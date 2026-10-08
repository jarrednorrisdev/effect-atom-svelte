<!--
  @component
  A panel docked along the bottom of the window that shows the atom registry live: its dependency
  graph, a sheet per atom and a timeline of everything it does. Development only unless you set
  `production`: in a production build without it, or on the server, it renders nothing.

  It's drawn like the effect-atom-svelte docs: ruled in hairlines, with mono labels, numbered views
  and an amber accent, in the page's own colours where it has them (--background, --foreground,
  --border, --brand and the rest) and the docs' zinc and amber where it doesn't. Drag its top line
  to make it taller or shorter; the page gets room below it for as long as it's open.

  It follows the registry of the nearest `RegistryProvider`, or the one given as `registry`. When
  the app has several, a picker in the panel switches between them.

  Render it only in development, behind Vite's `DEV` flag, so a build leaves it out: the README
  shows how. To show it in production too, as the effect-atom-svelte docs do, set `production`.
-->
<script lang="ts">
  import { BROWSER, DEV } from "esm-env";
  import type { AtomRegistry } from "effect/reactivity";
  import { getRegistry } from "effect-atom-svelte";
  import { inspect, watchRegistries } from "effect-atom-svelte/inspector";
  import { onMount, tick } from "svelte";

  import GraphView from "./internal/graph-view.svelte";
  import { Model } from "./internal/model.svelte.ts";
  import SettingsView from "./internal/settings-view.svelte";
  import type { Corner } from "./internal/settings-view.svelte";
  import { defaultShortcut, formatShortcut, matchesShortcut, parseShortcut } from "./internal/shortcut.ts";
  import SheetsView from "./internal/sheets-view.svelte";
  import TimelineView from "./internal/timeline-view.svelte";

  interface Props {
    /** The registry to show. Defaults to the nearest `RegistryProvider`'s. */
    readonly registry?: AtomRegistry.AtomRegistry | undefined;
    /** Whether the panel starts open. Defaults to how it was left. */
    readonly open?: boolean | undefined;
    /** Light paper, a dark blueprint, or the page's own (`auto`: a `dark` class on `<html>`, or the system's). */
    readonly theme?: "auto" | "light" | "dark" | undefined;
    /**
     * Shows the panel in production builds too, for a site that lets its visitors watch its atoms.
     * Without it the panel renders nothing outside development. In production it follows the
     * nearest provider's registry, or `registry`, with no picker: only development lists the rest.
     */
    readonly production?: boolean | undefined;
    /**
     * The keyboard shortcut that opens and closes the panel, as "alt+shift+a" (the default) or
     * "ctrl+shift+f2". Whoever uses the panel can change it in its settings.
     */
    readonly shortcut?: string | undefined;
  }

  const {
    registry,
    open: startOpen,
    production = false,
    shortcut: appShortcut = defaultShortcut,
    theme = "auto",
  }: Props = $props();

  type Tab = "graph" | "sheets" | "timeline" | "settings";
  interface Saved {
    readonly open: boolean;
    readonly tab: Tab;
    readonly plumbing: boolean;
    readonly expanded: boolean;
    readonly height: number;
    /** Only one changed in the settings: otherwise the app's, which may change. */
    readonly shortcut: string | undefined;
    readonly corner: Corner;
    readonly opacity: number;
    readonly scale: number;
  }
  const storageKey = "effect-atom-svelte-devtools";
  const load = (): Partial<Saved> => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? "{}") as Partial<Saved>;
    } catch {
      return {};
    }
  };

  // svelte-ignore state_referenced_locally
  const enabled = BROWSER && (DEV || production);
  // The registry in context, read while the component sets up, as context must be.
  // svelte-ignore state_referenced_locally
  const nearest = enabled ? (registry ?? getRegistry()) : undefined;

  let mounted = $state(false);
  let open = $state(false);
  let tab = $state<Tab>("graph");
  let showPlumbing = $state(false);
  let expanded = $state(false);
  // The dock's height, in pixels, when not enlarged; dragging its top line changes it.
  let height = $state(320);
  // svelte-ignore state_referenced_locally
  let shortcut = $state(appShortcut);
  let corner = $state<Corner>("bottom-right");
  // The launcher's opacity while nothing points at it, and its size.
  let opacity = $state(1);
  let scale = $state(1);
  let innerHeight = $state(800);
  let innerWidth = $state(1200);
  let selected = $state<number>();
  let dark = $state(false);
  let registries = $state.raw<readonly AtomRegistry.AtomRegistry[]>([]);
  let chosen = $state.raw<AtomRegistry.AtomRegistry | undefined>(nearest);
  let model = $state.raw<Model>();
  let dock = $state<HTMLElement>();
  let launcher = $state<HTMLElement>();
  // Opened from the launcher, the dock takes focus; opened as it was left, on load, it doesn't.
  let focusOnOpen = false;

  onMount(() => {
    if (!enabled) {
      return;
    }
    const saved = load();
    open = startOpen ?? saved.open ?? false;
    tab = saved.tab ?? "graph";
    showPlumbing = saved.plumbing ?? false;
    expanded = saved.expanded ?? false;
    height = saved.height ?? 320;
    // Settings saved by 0.2.1 hold the default even when nobody chose it, which would hide a shortcut
    // the app sets: the default counts as unset.
    shortcut =
      saved.shortcut === undefined || saved.shortcut === defaultShortcut
        ? appShortcut
        : saved.shortcut;
    corner = saved.corner ?? "bottom-right";
    opacity = saved.opacity ?? 1;
    scale = saved.scale ?? 1;
    mounted = true;

    const stopWatching = watchRegistries((list) => {
      // A registry given as a prop stays in the picker, even one no provider holds.
      registries = registry !== undefined && !list.includes(registry) ? [registry, ...list] : list;
      if (chosen === undefined || !registries.includes(chosen)) {
        chosen = nearest !== undefined && registries.includes(nearest) ? nearest : (registries[0] ?? nearest);
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
    if (!enabled || !mounted) {
      return;
    }
    const saved: Saved = {
      corner,
      expanded,
      height,
      opacity,
      open,
      plumbing: showPlumbing,
      scale,
      shortcut: shortcut === appShortcut ? undefined : shortcut,
      tab,
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify(saved));
    } catch {
      // Storage may be full or turned off; the panel then starts as it starts.
    }
  });

  // How tall the dock is drawn: enlarged, it takes most of the window; otherwise what was dragged,
  // kept between a usable minimum and most of the window.
  const shown = $derived(
    expanded ? Math.round(innerHeight * 0.85) : Math.min(Math.max(height, 160), innerHeight * 0.85)
  );

  // While open, the page gets room below its end, so the dock never hides the last of it.
  $effect(() => {
    if (!enabled || !open || !mounted) {
      return;
    }
    const { body } = document;
    const before = body.style.paddingBottom;
    body.style.paddingBottom = `${shown}px`;
    return () => {
      body.style.paddingBottom = before;
    };
  });

  /** Drags the dock's top line: the dock follows the pointer until it's let go. */
  const resize = (event: PointerEvent) => {
    event.preventDefault();
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    const start = event.clientY;
    const from = shown;
    expanded = false;
    const move = (next: PointerEvent) => {
      height = Math.round(from + start - next.clientY);
    };
    const stop = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  };

  $effect(() => {
    if (dock !== undefined && focusOnOpen) {
      focusOnOpen = false;
      dock.focus();
    }
  });

  const openPanel = () => {
    focusOnOpen = true;
    open = true;
  };
  /** Closes the dock; focus inside it goes back to the launcher, rather than to the page's start. */
  const closePanel = async () => {
    const inside = dock?.contains(document.activeElement) ?? false;
    open = false;
    if (inside) {
      await tick();
      launcher?.focus();
    }
  };

  /** The dock's top line from the keyboard: arrows make it taller or shorter, Home resets it. */
  const resizeByKey = (event: KeyboardEvent) => {
    const step = event.shiftKey ? 96 : 24;
    const by = { ArrowDown: -step, ArrowUp: step }[event.key];
    if (by !== undefined) {
      event.preventDefault();
      expanded = false;
      height = Math.round(shown + by);
    } else if (event.key === "Home") {
      event.preventDefault();
      expanded = false;
      height = 320;
    }
  };

  const mac = BROWSER && /Mac|iPhone|iPad/u.test(navigator.platform);
  const shortcutLabel = $derived.by(() => {
    const parsed = parseShortcut(shortcut);
    return parsed === undefined ? "no shortcut" : formatShortcut(parsed, mac);
  });
  // As aria-keyshortcuts writes it: "Alt+Shift+A".
  const keyShortcuts = $derived.by(() => {
    const parsed = parseShortcut(shortcut);
    return parsed === undefined ? undefined : formatShortcut(parsed, false).replaceAll(" ", "+").replace("Ctrl", "Control");
  });

  /** The shortcut, from anywhere on the page: opens the panel, or closes it. */
  const onShortcut = (event: KeyboardEvent) => {
    const parsed = parseShortcut(shortcut);
    if (!enabled || !mounted || parsed === undefined || !matchesShortcut(event, parsed)) {
      return;
    }
    event.preventDefault();
    if (open) {
      void closePanel();
    } else {
      openPanel();
    }
  };

  // Dragging the launcher: it follows the pointer, then settles in the corner nearest where it was
  // let go. A press that barely moves is a click.
  let dragAt = $state<{ readonly x: number; readonly y: number }>();
  let dragged = false;
  const drag = (event: PointerEvent) => {
    if (event.button !== 0) {
      return;
    }
    const button = event.currentTarget as HTMLElement;
    const box = button.getBoundingClientRect();
    const offsetX = event.clientX - box.left;
    const offsetY = event.clientY - box.top;
    const startX = event.clientX;
    const startY = event.clientY;
    dragged = false;
    // No text selection: a selection would make the next press start the browser's own drag of
    // it, which cancels the pointer.
    event.preventDefault();
    // From the press on, so a quick drag that leaves the button still moves it.
    button.setPointerCapture(event.pointerId);
    const move = (next: PointerEvent) => {
      if (!dragged && Math.hypot(next.clientX - startX, next.clientY - startY) < 5) {
        return;
      }
      dragged = true;
      dragAt = { x: next.clientX - offsetX, y: next.clientY - offsetY };
    };
    const stop = (last: PointerEvent) => {
      button.removeEventListener("pointermove", move);
      button.removeEventListener("pointerup", stop);
      button.removeEventListener("pointercancel", stop);
      if (dragged) {
        const top = last.clientY < innerHeight / 2;
        const left = last.clientX < innerWidth / 2;
        corner = `${top ? "top" : "bottom"}-${left ? "left" : "right"}`;
      }
      dragAt = undefined;
    };
    button.addEventListener("pointermove", move);
    button.addEventListener("pointerup", stop);
    button.addEventListener("pointercancel", stop);
  };
  const launch = () => {
    // The click that ends a drag doesn't open the panel.
    if (dragged) {
      dragged = false;
      return;
    }
    openPanel();
  };

  const pad = (count: number) => String(count).padStart(2, "0");

  const select = (id: number | undefined) => {
    selected = id;
    tab = "sheets";
  };
  const registryName = (index: number) => (index === 0 ? "registry 1" : `registry ${index + 1}`);
  const tabs: readonly { readonly id: Tab; readonly label: string }[] = [
    { id: "graph", label: "Graph" },
    { id: "sheets", label: "Sheets" },
    { id: "timeline", label: "Timeline" },
    { id: "settings", label: "Settings" },
  ];
</script>

<svelte:window bind:innerHeight bind:innerWidth onkeydown={onShortcut} />

{#if enabled && mounted && model}
  <!-- data-atom-devtools: where an app sets the panel's own colours and fonts (README, Theming). -->
  <div class="devtools" class:dark data-atom-devtools>
    {#if open}
      <!-- A region of the page, not a modal: the page stays usable with it open. Escape from anything
           in it closes it. -->
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <section
        bind:this={dock}
        style:height="{shown}px"
        aria-label="Atom devtools"
        class="dock"
        onkeydown={(event) => {
          if (event.key === "Escape") {
            void closePanel();
          }
        }}
        tabindex="-1">
        <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
        <div
          aria-label="Resize the panel"
          aria-orientation="horizontal"
          aria-valuemax={Math.round(innerHeight * 0.85)}
          aria-valuemin={160}
          aria-valuenow={Math.round(shown)}
          class="resize"
          ondblclick={() => (height = 320)}
          onkeydown={resizeByKey}
          onpointerdown={resize}
          role="separator"
          tabindex="0"
          title="Drag to resize; double-click to reset"></div>
        <header class="bar">
          <span class="cell title"><b aria-hidden="true">◎</b> Atoms</span>
          <nav aria-label="Views" class="tabs">
            {#each tabs as item, index (item.id)}
              <button aria-pressed={tab === item.id} class="cell tab" onclick={() => (tab = item.id)} type="button">
                <b>{pad(index + 1)}</b>
                {item.label}
              </button>
            {/each}
          </nav>
          <span class="spacer"></span>
          <span class="cell count">Atoms <b>{pad(model.totals.atoms)}</b></span>
          <span class="cell count">Readers <b>{pad(model.totals.readers)}</b></span>
          <span class="cell count">Updates <b>{pad(model.totals.updates)}</b></span>
          <span class="cell count" class:alert={model.totals.interruptions > 0}>Interrupted <b>{pad(model.totals.interruptions)}</b></span>
          {#if registries.length > 1}
            <label class="cell">
              <span class="sr">Registry</span>
              <select
                class="picker"
                onchange={(event) => (chosen = registries[Number(event.currentTarget.value)])}
                value={String(registries.indexOf(chosen as AtomRegistry.AtomRegistry))}>
                {#each registries as item, index (item)}
                  <option value={String(index)}>{registryName(index)}{item === nearest ? " (this one)" : ""}</option>
                {/each}
              </select>
            </label>
          {/if}
          <label class="cell toggle">
            <input bind:checked={showPlumbing} type="checkbox" />
            Plumbing
          </label>
          <button aria-label={expanded ? "Shrink the panel" : "Enlarge the panel"} class="cell icon" onclick={() => (expanded = !expanded)} title={expanded ? "Shrink" : "Enlarge"} type="button">
            <svg aria-hidden="true" height="12" viewBox="0 0 12 12" width="12">
              {#if expanded}
                <path d="M2 5h8M2 7h8" fill="none" stroke="currentColor" stroke-width="1.25" />
              {:else}
                <path d="M2 4l4-3 4 3M2 8l4 3 4-3" fill="none" stroke="currentColor" stroke-width="1.25" />
              {/if}
            </svg>
          </button>
          <button aria-label="Close the panel" class="cell icon" onclick={closePanel} title="Close (Esc)" type="button">
            <svg aria-hidden="true" height="12" viewBox="0 0 12 12" width="12">
              <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" fill="none" stroke="currentColor" stroke-width="1.25" />
            </svg>
          </button>
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
          {:else if tab === "timeline"}
            <TimelineView {model} onselect={select} {showPlumbing} />
          {:else}
            <SettingsView bind:corner bind:opacity bind:scale bind:shortcut defaultShortcut={appShortcut} />
          {/if}
        </div>
      </section>
    {:else}
      <button
        bind:this={launcher}
        style:--launcher-opacity={opacity}
        style:--launcher-scale={scale}
        style:left={dragAt ? `${dragAt.x}px` : undefined}
        style:top={dragAt ? `${dragAt.y}px` : undefined}
        aria-keyshortcuts={keyShortcuts}
        aria-label="Open the atom devtools"
        class={["launcher", corner, dragAt && "dragging"]}
        onclick={launch}
        onpointerdown={drag}
        title="Atom devtools ({shortcutLabel}). Drag to move."
        type="button">
        <b aria-hidden="true">◎</b> Atoms <span class="n">{pad(model.totals.atoms)}</span>
      </button>
    {/if}
  </div>
{/if}

<style>
  /*
   * The docs' design language: zinc and amber, hairlines, mono labels. Each token reads the page's
   * own where it has one (an app built on the docs' or shadcn's tokens), and falls back to the docs'
   * values. The views use the short names; the graph module reads the page's names, so the dock
   * hands those on too (on .dock, a level down, so neither refers to itself).
   */
  .devtools {
    --paper: var(--background, #fff);
    --ink: var(--foreground, #18181b);
    --muted: var(--muted-foreground, #52525b);
    --subtle: var(--subtle-foreground, #a1a1aa);
    --line: var(--border, #e4e4e7);
    --faint: color-mix(in oklab, var(--ink) 5%, transparent);
    --accent: var(--brand, #d97706);
    --accent-text: var(--brand-text, #b45309);
    --pulse: var(--accent);
    --success: var(--tone-success, #16a34a);
    --alert: var(--tone-failure, #dc2626);
    --mono: var(--font-mono, ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace);
    --serif: var(--font-serif, ui-serif, Georgia, "Times New Roman", serif);
    --radius: 6px;
    color: var(--ink);
    font-family: var(--mono);
    font-size: 13px;
    line-height: 1.4;
  }
  .devtools.dark {
    --paper: var(--background, #09090b);
    --ink: var(--foreground, #fafafa);
    --muted: var(--muted-foreground, #a1a1aa);
    --subtle: var(--subtle-foreground, #71717a);
    --line: var(--border, #27272a);
    --accent: var(--brand, #f59e0b);
    --accent-text: var(--brand-text, #f59e0b);
    --success: var(--tone-success, #22c55e);
    --alert: var(--tone-failure, #ef4444);
  }
  .devtools :global(*) {
    box-sizing: border-box;
  }
  /* The launcher: one ruled cell in the corner, like a cell of the dock's bar. */
  .launcher {
    align-items: center;
    background: var(--paper);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    color: var(--muted);
    cursor: pointer;
    display: inline-flex;
    font-family: var(--mono);
    font-size: calc(10.5px * var(--launcher-scale, 1));
    gap: calc(0.5rem * var(--launcher-scale, 1));
    height: calc(32px * var(--launcher-scale, 1));
    letter-spacing: 0.08em;
    opacity: var(--launcher-opacity, 1);
    padding: 0 calc(0.75rem * var(--launcher-scale, 1));
    position: fixed;
    text-transform: uppercase;
    touch-action: none;
    transition: opacity 0.15s;
    user-select: none;
    z-index: 2147483000;
  }
  .launcher.bottom-right {
    bottom: 16px;
    right: 16px;
  }
  .launcher.bottom-left {
    bottom: 16px;
    left: 16px;
  }
  .launcher.top-right {
    right: 16px;
    top: 16px;
  }
  .launcher.top-left {
    left: 16px;
    top: 16px;
  }
  /* While dragged, it's placed by its left and top alone. */
  .launcher.dragging {
    bottom: auto;
    cursor: grabbing;
    right: auto;
  }
  /* Faded or not, it's opaque while pointed at, focused or dragged. */
  .launcher:hover,
  .launcher:focus-visible,
  .launcher.dragging {
    opacity: 1;
  }
  .launcher:hover {
    border-color: var(--accent);
    color: var(--ink);
  }
  .launcher b {
    color: var(--accent);
    font-weight: 400;
  }
  .launcher .n {
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }
  /* The dock: across the bottom of the window, ruled off from the page by its top line. */
  .dock {
    --background: var(--paper);
    --foreground: var(--ink);
    --muted-foreground: var(--muted);
    --subtle-foreground: var(--subtle);
    --border: var(--line);
    --brand: var(--accent);
    --brand-text: var(--accent-text);
    --tone-success: var(--success);
    --tone-failure: var(--alert);
    --font-mono: var(--mono);
    --font-serif: var(--serif);
    background: var(--paper);
    border-top: 1px solid var(--line);
    bottom: 0;
    display: flex;
    flex-direction: column;
    left: 0;
    position: fixed;
    right: 0;
    z-index: 2147483000;
    animation: rise 0.2s cubic-bezier(0.2, 0.7, 0.2, 1) both;
  }
  .resize {
    cursor: ns-resize;
    height: 7px;
    left: 0;
    position: absolute;
    right: 0;
    top: -4px;
    z-index: 1;
  }
  .resize:focus-visible {
    box-shadow: inset 0 -2px 0 var(--accent);
    outline: none;
  }
  .dock:focus-visible {
    outline: none;
  }
  .resize:hover {
    box-shadow: inset 0 -1px 0 color-mix(in oklab, var(--accent) 60%, transparent);
  }
  /* The bar: a row of ruled cells, as the docs' site header is. */
  .bar {
    align-items: stretch;
    border-bottom: 1px solid var(--line);
    display: flex;
    flex: none;
    height: 36px;
    overflow-x: auto;
  }
  .cell {
    align-items: center;
    background: none;
    border: 0;
    border-left: 1px solid var(--line);
    color: var(--muted);
    display: inline-flex;
    flex: none;
    font: inherit;
    font-size: 10.5px;
    gap: 0.45rem;
    letter-spacing: 0.08em;
    padding: 0 0.9rem;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .cell b {
    color: var(--accent-text);
    font-weight: 400;
  }
  .title {
    border-left: 0;
    color: var(--ink);
  }
  .tabs {
    display: flex;
  }
  .tab {
    cursor: pointer;
  }
  .tab:hover,
  .icon:hover {
    background: var(--faint);
    color: var(--ink);
  }
  .tab[aria-pressed="true"] {
    box-shadow: inset 0 -2px 0 var(--accent);
    color: var(--ink);
  }
  .spacer {
    border-left: 1px solid var(--line);
    flex: 1;
  }
  .count b {
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }
  .count.alert b {
    color: var(--alert);
  }
  .picker {
    background: var(--paper);
    border: 1px solid var(--line);
    border-radius: 4px;
    color: var(--ink);
    font: inherit;
    letter-spacing: normal;
    padding: 0.1rem 0.25rem;
    text-transform: none;
  }
  .toggle {
    cursor: pointer;
  }
  .toggle input {
    accent-color: var(--accent);
    margin: 0;
  }
  .icon {
    cursor: pointer;
    justify-content: center;
    padding: 0;
    width: 36px;
  }
  .sr {
    clip-path: inset(50%);
    height: 1px;
    overflow: hidden;
    position: absolute;
    width: 1px;
  }
  .notice {
    border-bottom: 1px solid var(--line);
    color: var(--muted);
    flex: none;
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
  }
  @keyframes rise {
    from {
      transform: translateY(12px);
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .dock {
      animation: none;
    }
  }
</style>
