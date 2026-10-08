<!--
  The panel's settings: the shortcut that opens and closes it, and where the launcher sits, how
  opaque it is and how big. The panel saves them with the rest of its state.
-->
<script module lang="ts">
  /** Where the launcher sits. */
  export type Corner = "bottom-right" | "bottom-left" | "top-right" | "top-left";
</script>

<script lang="ts">
  import {
    formatShortcut,
    parseShortcut,
    shortcutFromEvent,
    stringifyShortcut,
  } from "./shortcut.ts";

  interface Props {
    /** The shortcut, as "alt+shift+a". */
    shortcut: string;
    /** The shortcut the app set (`shortcut` prop), which Reset goes back to. */
    readonly defaultShortcut: string;
    corner: Corner;
    /** The launcher's opacity while nothing points at it, from 0.2 to 1. */
    opacity: number;
    /** The launcher's size, from 0.75 to 1.5. */
    scale: number;
  }

  let {
    corner = $bindable(),
    defaultShortcut,
    opacity = $bindable(),
    scale = $bindable(),
    shortcut = $bindable(),
  }: Props = $props();

  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/u.test(navigator.platform);
  const shown = $derived.by(() => {
    const parsed = parseShortcut(shortcut);
    return parsed === undefined ? "none" : formatShortcut(parsed, mac);
  });

  // While recording, the next key press that can be a shortcut becomes it; Escape cancels.
  let recording = $state(false);
  const record = (event: KeyboardEvent) => {
    if (!recording) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") {
      recording = false;
      return;
    }
    const next = shortcutFromEvent(event);
    if (next !== undefined) {
      shortcut = stringifyShortcut(next);
      recording = false;
    }
  };

  const corners: readonly { readonly id: Corner; readonly label: string }[] = [
    { id: "top-left", label: "Top left" },
    { id: "top-right", label: "Top right" },
    { id: "bottom-left", label: "Bottom left" },
    { id: "bottom-right", label: "Bottom right" },
  ];
</script>

<svelte:window onkeydowncapture={record} />

<div class="settings">
  <div class="row">
    <span class="key" id="devtools-shortcut">Shortcut</span>
    <div class="value">
      <kbd aria-labelledby="devtools-shortcut">{recording ? "Press a shortcut…" : shown}</kbd>
      <button aria-pressed={recording} class="tool" onclick={() => (recording = !recording)} type="button">
        {recording ? "Cancel" : "Change"}
      </button>
      <button class="tool" disabled={shortcut === defaultShortcut} onclick={() => (shortcut = defaultShortcut)} type="button">
        Reset
      </button>
      <p class="note">
        Opens and closes the panel anywhere on the page. It needs Ctrl, Alt or {mac ? "⌘" : "Meta"} (or a function key), so it can't catch typing.
      </p>
    </div>
  </div>
  <div class="row">
    <span class="key" id="devtools-corner">Button</span>
    <div class="value">
      <div aria-labelledby="devtools-corner" class="corners" role="group">
        {#each corners as item (item.id)}
          <button aria-pressed={corner === item.id} class="tool" onclick={() => (corner = item.id)} type="button">
            {item.label}
          </button>
        {/each}
      </div>
      <p class="note">Or drag the button: it settles in the nearest corner.</p>
    </div>
  </div>
  <label class="row">
    <span class="key">Opacity</span>
    <span class="value">
      <input bind:value={opacity} max="1" min="0.2" step="0.05" type="range" />
      <output>{Math.round(opacity * 100)}%</output>
      <span class="note">The button is opaque again while you point at it or focus it.</span>
    </span>
  </label>
  <label class="row">
    <span class="key">Size</span>
    <span class="value">
      <input bind:value={scale} max="1.5" min="0.75" step="0.05" type="range" />
      <output>{Math.round(scale * 100)}%</output>
    </span>
  </label>
</div>

<style>
  .settings {
    font-family: var(--mono);
    font-size: 0.74rem;
    height: 100%;
    overflow: auto;
  }
  .row {
    align-items: baseline;
    border-bottom: 1px solid var(--line);
    display: grid;
    gap: 1rem;
    grid-template-columns: 7rem minmax(0, 1fr);
    padding: 0.75rem 0.9rem;
  }
  .key {
    color: var(--muted);
    font-size: 10.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .value {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 0.75rem;
  }
  kbd {
    border: 1px solid var(--line);
    border-radius: 4px;
    color: var(--ink);
    font: inherit;
    min-width: 6rem;
    padding: 0.2rem 0.6rem;
    text-align: center;
  }
  .corners {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .tool {
    background: none;
    border: 1px solid var(--line);
    border-radius: 4px;
    color: var(--ink);
    cursor: pointer;
    font: inherit;
    letter-spacing: 0.04em;
    padding: 0.2rem 0.6rem;
  }
  .tool:hover:not(:disabled) {
    border-color: var(--accent);
  }
  .tool:disabled {
    color: var(--subtle);
    cursor: default;
  }
  .tool[aria-pressed="true"] {
    background: color-mix(in oklab, var(--accent) 12%, transparent);
    border-color: var(--accent);
  }
  input[type="range"] {
    accent-color: var(--accent);
    width: 12rem;
  }
  output {
    color: var(--ink);
    font-variant-numeric: tabular-nums;
    min-width: 3rem;
  }
  .note {
    color: var(--muted);
    flex-basis: 100%;
    font-family: var(--serif);
    font-size: 0.8rem;
    font-style: italic;
    margin: 0;
  }
</style>
