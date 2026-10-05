<!--
  @component
  A tile that holds one result, colored by its state, with an optional caption below, like the
  tiles on effect.kitlangton.com, and moving like them (Motion). While `busy` or running it keeps
  its content, dims it, sweeps a shine across and jitters, so a refresh visibly keeps the old
  value. When a result arrives (its tone changes or `busy` ends) it flashes and its content pops
  with a spring, so a new value is noticed even when it equals the old one; a failure shakes it.
  With reduced motion only the colors change.

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
  import { animate } from "motion";
  import { untrack } from 'svelte';
import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from "svelte/elements";

  import { jitter, reducedMotion, shake, springs } from "./motion.ts";
  import { getExampleState } from './tone.ts';
import type { Tone } from './tone.ts';

  interface Props extends HTMLAttributes<HTMLSpanElement> {
    /** True while a new result is on its way and this one is kept (`waiting`). */
    readonly busy?: boolean;
    readonly children: Snippet;
    /** `value` (the default) shows a short value large; `message` suits a sentence. */
    readonly kind?: "message" | "value";
    /** While running, a bar fills across the tile over this many milliseconds. */
    readonly duration?: number | undefined;
    /** A caption under the tile, such as the atom's name. */
    readonly label?: string;
    readonly tone: Tone;
  }

  const {
    busy = false,
    children,
    duration,
    kind = "value",
    label,
    tone,
    ...rest
  }: Props = $props();

  const example = getExampleState();

  /** A result arrived: flash, pop the content, and shake a failure. */
  const land = (chip: HTMLElement, landed: Tone) => {
    animate(chip, { "--flash": [0.6, 0] }, { duration: 1, ease: "linear" });
    if (reducedMotion()) {
      return;
    }
    const content = chip.querySelector(".content");
    if (content) {
      animate(content, { scale: [1.3, 1] }, springs.contentScale);
    }
    if (landed === "failure") {
      void shake(chip);
    } else {
      animate(chip, { scale: [0.9, 1] }, springs.bouncy);
    }
  };

  // A result arrives when the tone changes or busy ends, or when a chip appears in an example the
  // reader has used (examples often show a different chip per state). The page's own first
  // render stays still.
  let before: { busy: boolean; tone: Tone } | undefined;
  const arrive = (chip: HTMLElement) => {
    const now = { busy, tone };
    const was = before;
    before = now;
    untrack(() => {
      const arrived = was
        ? !now.busy && (now.tone !== was.tone || was.busy)
        : example?.touched === true && !now.busy && now.tone !== "running";
      if (arrived) {
        land(chip, now.tone);
      }
    });
  };

  // Jitters while working, as a running effect does; the cleanup settles it when the work ends.
  const run = (chip: HTMLElement) => {
    if (busy || tone === "running") {
      // A wide tile tilts far at its ends, so a sentence only shakes.
      return jitter(chip, kind === "message" ? { angle: 0 } : undefined);
    }
    return undefined;
  };
</script>

<span class="wrap">
  <span
    aria-busy={busy}
    class="chip"
    data-kind={kind}
    data-tone={tone}
    {...rest}
    {@attach arrive}
    {@attach run}
  >
    <span class="content">{@render children()}</span>
    {#if duration !== undefined && tone === "running"}
      <span aria-hidden="true" class="progress" style:--duration="{duration}ms"></span>
    {/if}
  </span>
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
    --flash: 0;
    --mark: var(--tone-idle);
    --text: var(--tone-idle-text);
    align-items: center;
    /* --flash (0 to 1, animated) brightens the tint when a result arrives. */
    background: color-mix(
      in oklab,
      var(--mark) calc(12% + var(--flash) * 40%),
      var(--background)
    );
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
    display: inline-block;
    transition: opacity 200ms;
  }
  /* A sentence reads better smaller than a value. */
  .chip[data-kind="message"] {
    font-family: var(--font-sans);
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1.35;
    text-align: center;
    text-wrap: balance;
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
  /* The time a running result takes, filling from the left. */
  .progress {
    animation: fill var(--duration) linear forwards;
    background: var(--tone-running);
    bottom: 0;
    height: 3px;
    left: 0;
    position: absolute;
    transform-origin: left;
  }
  @keyframes fill {
    from {
      width: 0;
    }
    to {
      width: 100%;
    }
  }
  .caption {
    color: var(--muted-foreground);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    line-height: 1rem;
  }
  @keyframes shine {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(100%);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .chip[aria-busy="true"]::after {
      animation: none;
    }
  }
</style>
