<!--
  @component
  A labeled box in a diagram, as in Effect's Module of the Week posts: an uppercase caption
  (REGISTRY, SERVER, BOUNDARY A), the part's contents, and optionally a counter in the corner that
  flashes when it changes (a reference count going 0, 1, 2, 1, 0). Its border takes the tone, and a
  `dashed` part reads as absent or released.

  ```svelte
  <Part count={holders} countLabel="readers" label="countAtom" tone={holders > 0 ? "success" : "idle"}>
    {value}
  </Part>
  ```

  Other attributes go on the box; the counter is an `<output>` named by `countLabel`.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  import FlashValue from "./flash-value.svelte";
  import type { Tone } from "./tone.ts";

  interface Props extends HTMLAttributes<HTMLDivElement> {
    readonly children?: Snippet;
    /** A number shown in the corner, such as a reference count. */
    readonly count?: number;
    /** What `count` counts, such as "readers"; names the counter. */
    readonly countLabel?: string;
    /** Draws the border dashed, for a part that is gone or not there yet. */
    readonly dashed?: boolean;
    readonly label: string;
    readonly tone?: Tone;
  }

  const {
    children,
    count,
    countLabel = "count",
    dashed = false,
    label,
    tone = "idle",
    ...rest
  }: Props = $props();
</script>

<div class={["part not-prose", dashed && "dashed"]} data-tone={tone} {...rest}>
  <div class="head">
    <span class="label">{label}</span>
    {#if count !== undefined}
      <span class="count">
        <FlashValue aria-label="{label} {countLabel}" value={count} />
        <span class="count-label">{countLabel}</span>
      </span>
    {/if}
  </div>
  {#if children}
    <div class="body">{@render children()}</div>
  {/if}
</div>

<style>
  .part {
    --mark: var(--tone-idle);
    background: var(--background);
    border: 1.5px solid color-mix(in oklab, var(--mark) 60%, transparent);
    border-radius: var(--radius-lg);
    min-width: 8rem;
    padding: 0.6rem 0.8rem;
    transition:
      border-color 200ms,
      box-shadow 200ms,
      opacity 200ms;
  }
  .part[data-tone="running"] {
    --mark: var(--tone-running);
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--tone-running) 20%, transparent);
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
  .dashed {
    border-style: dashed;
    opacity: 0.75;
  }
  .head {
    align-items: center;
    display: flex;
    gap: 0.75rem;
    justify-content: space-between;
  }
  .label,
  .count-label {
    color: var(--muted-foreground);
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .count {
    align-items: center;
    display: inline-flex;
    gap: 0.3rem;
  }
  .count :global(output) {
    font-weight: 700;
  }
  .body {
    font-size: 0.875rem;
    margin-top: 0.4rem;
  }
</style>
