<!--
  @component
  A tile that holds one result, with an optional caption below, after the tiles on
  effect.kitlangton.com but ruled like the site's frame: a hairline box with square corners whose
  state is a line along its top (a failure's text is red too). It moves like those tiles (Motion):
  while `busy` or running it keeps its content, dims it, sweeps the line and jitters, so a refresh
  visibly keeps the old value. When a result arrives (its tone changes or `busy` ends) it flashes and its content pops
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
  import { untrack } from "svelte";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  import { jitter, reducedMotion, shake, springs } from "./motion.ts";
  import { getExampleState } from "./tone.ts";
  import type { Tone } from "./tone.ts";

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
      if (now.busy) {
        return;
      }
      const arrived = was
        ? now.tone !== was.tone || was.busy
        : example?.touched === true && now.tone !== "running";
      if (arrived) {
        land(chip, now.tone);
      }
    });
  };

  // Jitters while working, as a running effect does; the cleanup settles it when the work ends.
  const run = (chip: HTMLElement) => {
    if (!busy && tone !== "running") {
      return;
    }
    // A wide tile tilts far at its ends, so a sentence only shakes.
    return jitter(chip, kind === "message" ? { angle: 0 } : undefined);
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
      <span aria-hidden="true" class="progress" style:--duration="{duration}ms"
      ></span>
    {/if}
  </span>
  {#if label}
    <span class="caption">{label}</span>
  {/if}
</span>

<style>
  .wrap {
    align-items: flex-start;
    display: inline-flex;
    flex-direction: column;
    gap: 0.35rem;
    vertical-align: top;
  }
  .chip {
    --flash: 0;
    --mark: var(--tone-idle);
    align-items: center;
    /* --flash (0 to 1, animated) tints the tile when a result arrives. */
    background: color-mix(
      in oklab,
      var(--mark) calc(var(--flash) * 25%),
      var(--background)
    );
    border: 1px solid var(--border);
    color: var(--foreground);
    display: inline-flex;
    font-family: var(--font-mono);
    font-size: 1.25rem;
    font-weight: 500;
    justify-content: center;
    min-height: 3.5rem;
    min-width: 3.5rem;
    overflow: hidden;
    padding: 0.25rem 0.9rem;
    position: relative;
    transition: color 200ms;
  }
  /* The state, as a line along the top edge. */
  .chip::before {
    background: var(--mark);
    content: "";
    height: 2px;
    left: 0;
    position: absolute;
    right: 0;
    top: 0;
    transition: background-color 200ms;
  }
  .chip[data-tone="idle"]::before {
    background: var(--border-strong);
  }
  .chip[data-tone="running"] {
    --mark: var(--tone-running);
  }
  .chip[data-tone="success"] {
    --mark: var(--tone-success);
  }
  .chip[data-tone="failure"] {
    --mark: var(--tone-failure);
    color: var(--tone-failure-text);
  }
  .chip[data-tone="interrupted"] {
    --mark: var(--tone-interrupted);
    border-style: dashed;
    color: var(--tone-interrupted-text);
  }
  .chip[data-tone="interrupted"]::before {
    background: repeating-linear-gradient(
      90deg,
      var(--mark) 0 6px,
      transparent 6px 10px
    );
  }
  .content {
    display: inline-block;
    transition: opacity 200ms;
  }
  /* A sentence reads better smaller than a value. */
  .chip[data-kind="message"] {
    font-family: var(--font-sans);
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.35;
    text-align: center;
    text-wrap: balance;
  }
  /* Overrides the generic pulse that app.css gives anything busy in an example. */
  .chip[aria-busy="true"] {
    animation: none;
    cursor: progress;
    opacity: 1;
  }
  .chip[aria-busy="true"] .content {
    opacity: 0.55;
  }
  /* While busy, the top line is a sweep in the running color. */
  .chip[aria-busy="true"]::before {
    animation: sweep 1.1s linear infinite;
    background: linear-gradient(
      90deg,
      transparent 0 20%,
      var(--tone-running) 20% 50%,
      transparent 50%
    );
    background-size: 200% 100%;
  }
  /* The time a running result takes, filling along the bottom from the left. */
  .progress {
    animation: fill var(--duration) linear forwards;
    background: var(--tone-running);
    bottom: 0;
    height: 2px;
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
  @keyframes sweep {
    from {
      background-position: 100% 0;
    }
    to {
      background-position: -100% 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .chip[aria-busy="true"]::before {
      animation: none;
      background: var(--tone-running);
    }
  }
</style>
