<!--
  @component
  A tile that holds one result, colored by its state, with an optional caption below, like the
  tiles on effect.kitlangton.com. While `busy` it keeps its content, dims it and sweeps a shine
  across, so a refresh visibly keeps the old value. It pops when its tone changes or when `busy`
  ends, so a new value is noticed even when it equals the old one.

  ```svelte
  {#if die.current._tag === "Success"}
    <ResultChip busy={die.current.waiting} label="dieAtom" tone="success">
      {die.current.value}
    </ResultChip>
  {/if}
  ```

  Use `toneOf(result)` from `tone.ts` to pick the tone from an `AsyncResult`. Other attributes go
  on the tile, which carries `aria-busy`.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  import type { Tone } from "./tone.ts";

  interface Props extends HTMLAttributes<HTMLSpanElement> {
    /** True while a new result is on its way and this one is kept (`waiting`). */
    readonly busy?: boolean;
    readonly children: Snippet;
    /** `value` (the default) shows a short value large; `message` suits a sentence. */
    readonly kind?: "message" | "value";
    /** A caption under the tile, such as the atom's name. */
    readonly label?: string;
    readonly tone: Tone;
  }

  const { busy = false, children, kind = "value", label, tone, ...rest }: Props = $props();

  // Counts arrivals (a tone change, or busy ending) to restart the pop animation.
  let arrivals = $state(0);
  let previous: { busy: boolean; tone: Tone } | undefined;
  $effect.pre(() => {
    const now = { busy, tone };
    if (previous && (previous.tone !== now.tone || (previous.busy && !now.busy))) {
      arrivals += 1;
    }
    previous = now;
  });
</script>

<span class="wrap">
  {#key arrivals}
    <span aria-busy={busy} class={["chip", arrivals > 0 && "arrived"]}
      data-kind={kind}
      data-tone={tone} {...rest}>
      <span class="content">{@render children()}</span>
    </span>
  {/key}
  {#if label}
    <span class="caption">{label}</span>
  {/if}
</span>

<style>
  .wrap {
    align-items: center;
    display: inline-flex;
    flex-direction: column;
    gap: 0.35rem;
    vertical-align: top;
  }
  .chip {
    --mark: var(--tone-idle);
    --text: var(--tone-idle-text);
    align-items: center;
    background: color-mix(in oklab, var(--mark) 12%, var(--background));
    border: 1.5px solid color-mix(in oklab, var(--mark) 70%, transparent);
    border-radius: var(--radius-lg);
    box-shadow: 0 1px 2px color-mix(in oklab, var(--mark) 25%, transparent);
    color: var(--text);
    display: inline-flex;
    font-family: var(--font-mono);
    font-size: 1.25rem;
    font-weight: 700;
    justify-content: center;
    min-height: 3.5rem;
    min-width: 3.5rem;
    overflow: hidden;
    padding: 0.25rem 0.85rem;
    position: relative;
    transition:
      background-color 200ms,
      border-color 200ms,
      color 200ms;
  }
  .chip[data-tone="running"] {
    --mark: var(--tone-running);
    --text: var(--tone-running-text);
  }
  .chip[data-tone="success"] {
    --mark: var(--tone-success);
    --text: var(--tone-success-text);
  }
  .chip[data-tone="failure"] {
    --mark: var(--tone-failure);
    --text: var(--tone-failure-text);
  }
  .chip[data-tone="interrupted"] {
    --mark: var(--tone-interrupted);
    --text: var(--tone-interrupted-text);
    border-style: dashed;
  }
  .content {
    transition: opacity 200ms;
  }
  /* A sentence reads better smaller than a value. */
  .chip[data-kind="message"] {
    font-family: var(--font-sans);
    font-size: 0.875rem;
    font-weight: 600;
  }
  /* Overrides the generic pulse that app.css gives anything busy in an example. */
  .chip[aria-busy="true"] {
    animation: none;
    border-color: var(--tone-running);
    cursor: progress;
    opacity: 1;
  }
  .chip[aria-busy="true"] .content {
    opacity: 0.55;
  }
  .chip[aria-busy="true"]::after {
    animation: shine 1.1s ease-in-out infinite;
    background: linear-gradient(
      100deg,
      transparent 20%,
      color-mix(in oklab, var(--tone-running) 30%, transparent) 50%,
      transparent 80%
    );
    content: "";
    inset: 0;
    position: absolute;
  }
  .arrived {
    animation: arrive 320ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .caption {
    color: var(--muted-foreground);
    font-family: var(--font-mono);
    font-size: 0.75rem;
  }
  @keyframes shine {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(100%);
    }
  }
  @keyframes arrive {
    from {
      transform: scale(0.85);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .arrived,
    .chip[aria-busy="true"]::after {
      animation: none;
    }
  }
</style>
