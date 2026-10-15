<!--
  @component
  A labeled box in a diagram, ruled like the site's frame: hairline borders, square corners and a
  cross at each corner. It has a caption in the site's label voice (REGISTRY, SERVER), the part's
  contents, and optionally a counter in the corner that flashes when it changes (a reference count
  going 0, 1, 2, 1, 0). A tone other than idle draws a line in its color along the top, and a
  `dashed` part reads as absent or released. With Motion, the line breathes while running and the
  part bounces when it settles into another state. Several parts side by side go in `Parts`, which
  rules them as one grid.

  ```svelte
  <Part count={holders} countLabel="readers" label="countAtom" tone={holders > 0 ? "success" : "idle"}>
    {value}
  </Part>
  ```

  Set `code` when the label is a name from the code (`countAtom`, `useAtomSet`): it then keeps its
  case instead of being shown in capitals. `note` is a short line under the label saying what the
  part is (`holds the value, in °C`), in the italic serif the graphs use for their notes.

  `actions` holds the part's controls, kept at the bottom so they line up across a row of parts:

  ```svelte
  <Part code label="countAtom">
    <FlashValue big value={count.current} />
    {#snippet actions()}<button onclick={add}>Add one</button>{/snippet}
  </Part>
  ```

  Other attributes go on the box; the counter is an `<output>` named by `countLabel`.
-->
<script lang="ts">
  import { animate } from "motion";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  import FlashValue from "./flash-value.svelte";
  import { onChange, reducedMotion, springs } from "./motion.ts";
  import type { Tone } from "./tone.ts";

  interface Props extends HTMLAttributes<HTMLDivElement> {
    /** Controls, at the bottom of the part. */
    readonly actions?: Snippet;
    readonly children?: Snippet;
    /** Shows the label as code, in its own case. */
    readonly code?: boolean;
    /** A number shown in the corner, such as a reference count. */
    readonly count?: number;
    /** What `count` counts, such as "readers"; names the counter. */
    readonly countLabel?: string;
    /** Draws the border dashed, for a part that is gone or not there yet. */
    readonly dashed?: boolean;
    readonly label: string;
    /** A short line under the label saying what the part is. */
    readonly note?: string;
    readonly tone?: Tone;
    /** Starts the contents at the top, for a tall part in a row of uneven ones. */
    readonly top?: boolean;
  }

  const {
    actions,
    children,
    code = false,
    count,
    countLabel = "count",
    dashed = false,
    label,
    note,
    tone = "idle",
    top = false,
    ...rest
  }: Props = $props();

  // A part that settles into a new state gives a small bounce.
  const settle = onChange(
    () => tone,
    (part, now) => {
      if (now !== "running" && !reducedMotion()) {
        animate(part, { scale: [0.96, 1] }, springs.bouncy);
      }
    }
  );

  // While running, its top line breathes, like the glow of a running effect.
  const glow = (part: HTMLElement) => {
    if (tone !== "running" || reducedMotion()) {
      return;
    }
    const pulse = animate(
      part,
      { "--glow": [1, 0.3, 1] },
      { duration: 1.5, ease: "easeInOut", repeat: Number.POSITIVE_INFINITY }
    );
    return () => {
      pulse.stop();
      part.style.removeProperty("--glow");
    };
  };
</script>

<div
  class={["part not-prose", dashed && "dashed", top && "top"]}
  data-tone={tone}
  {...rest}
  {@attach settle}
  {@attach glow}
>
  <span aria-hidden="true" class="corner tl"></span>
  <span aria-hidden="true" class="corner tr"></span>
  <span aria-hidden="true" class="corner bl"></span>
  <span aria-hidden="true" class="corner br"></span>
  <div class="head">
    <span class={["label", code && "code"]}>{label}</span>
    {#if count !== undefined}
      <span class="count">
        <FlashValue aria-label="{label} {countLabel}" value={count} />
        <span class="count-label">{countLabel}</span>
      </span>
    {/if}
  </div>
  {#if note}
    <p class="note">{note}</p>
  {/if}
  {#if children}
    <div class="body">{@render children()}</div>
  {/if}
  {#if actions}
    <div class="actions">{@render actions()}</div>
  {/if}
</div>

<style>
  .part {
    --mark: var(--tone-idle);
    border: 1px solid var(--border);
    /* A column, so a part stretched to its row's height puts the spare room in its body. */
    display: flex;
    flex-direction: column;
    min-width: 8rem;
    padding: 0.75rem 0.9rem 0.85rem;
    position: relative;
    transition: opacity 200ms;
  }
  /* The tone, as a line along the top edge; idle has none. --glow (0 to 1) pulses while running. */
  .part::before {
    background: var(--mark);
    content: "";
    height: 2px;
    left: -1px;
    opacity: var(--glow, 1);
    position: absolute;
    right: -1px;
    top: -1px;
    transition: background-color 200ms;
  }
  .part[data-tone="idle"]::before {
    display: none;
  }
  .part[data-tone="running"] {
    --mark: var(--tone-running);
  }
  .part[data-tone="success"] {
    --mark: var(--tone-success);
  }
  .part[data-tone="failure"] {
    --mark: var(--tone-failure);
  }
  .part[data-tone="interrupted"] {
    --mark: var(--tone-interrupted);
  }
  .part[data-tone="interrupted"]::before {
    background: repeating-linear-gradient(
      90deg,
      var(--mark) 0 6px,
      transparent 6px 10px
    );
  }
  .dashed {
    border-color: var(--border-strong);
    border-style: dashed;
    opacity: 0.75;
  }
  /* A cross where the edges meet, drawn as app.css's .rule-cross draws the page's. */
  .corner {
    height: 1px;
    pointer-events: none;
    position: absolute;
    width: 1px;
  }
  .corner::before,
  .corner::after {
    content: "";
    position: absolute;
  }
  .corner::before {
    border-top: 1px solid var(--cross);
    left: -5px;
    top: 0;
    width: 11px;
  }
  .corner::after {
    border-left: 1px solid var(--cross);
    height: 11px;
    left: 0;
    top: -5px;
  }
  .tl,
  .bl {
    left: -1px;
  }
  .tr,
  .br {
    right: -1px;
  }
  .tl,
  .tr {
    top: -1px;
  }
  .bl,
  .br {
    bottom: -1px;
  }
  .head {
    align-items: baseline;
    display: flex;
    gap: 0.75rem;
    justify-content: space-between;
  }
  /* The site's label voice (app.css's .docs-label); a name from the code keeps its case. */
  .label,
  .count-label {
    color: var(--muted-foreground);
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 400;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .label.code {
    color: var(--foreground);
    font-size: 0.75rem;
    letter-spacing: normal;
    text-transform: none;
  }
  .note {
    color: var(--muted-foreground);
    font-family: var(--font-serif);
    font-size: 0.8rem;
    font-style: italic;
    line-height: 1.35;
    margin: 0.15rem 0 0;
  }
  .count {
    align-items: baseline;
    display: inline-flex;
    flex: none;
    gap: 0.35rem;
  }
  /* The count is a figure in the accent, not a filled box. */
  .count :global(output) {
    background: none;
    color: var(--brand-text);
    font-size: 0.75rem;
    font-weight: 500;
    min-width: 0;
    padding: 0;
  }
  .body {
    /* Parts in a row share the tallest one's height; a shorter body sits in the middle. */
    align-content: center;
    flex: 1;
    font-size: 0.875rem;
    margin-top: 0.6rem;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }
  /* Overrides the margins .demo gives buttons, so a part's controls sit on its edges. */
  .actions :global(button) {
    margin: 0;
    white-space: nowrap;
  }
  .top .body {
    align-content: start;
  }
</style>
