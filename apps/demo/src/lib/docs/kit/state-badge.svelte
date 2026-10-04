<!--
  @component
  An `AsyncResult`'s state as a badge: `Initial`, `Success` or `Failure`, with ", waiting" and a
  spinner while `waiting` is true. Each state has its own color and icon; when the state changes
  the badge bounces and the icon pops in with a spring (Motion). Once the reader has used the example, the badge plays the `success` or
  `failure` cue when a run ends.

  ```svelte
  <StateBadge data-testid="die-state" result={die.current} />
  ```

  Other attributes (`data-testid`, `aria-label`) go on the `<output>`, whose text is exactly
  `Success` or `Success, waiting`, so tests can match it.
-->
<script lang="ts">
  import CheckIcon from "@lucide/svelte/icons/check";
  import CircleIcon from "@lucide/svelte/icons/circle";
  import LoaderIcon from "@lucide/svelte/icons/loader-circle";
  import XIcon from "@lucide/svelte/icons/x";
  import type { AsyncResult } from "effect/reactivity";
  import { animate } from "motion";
  import type { HTMLOutputAttributes } from "svelte/elements";

  import { onChange, reducedMotion, springs } from "./motion.ts";
  import { play } from "./sound.ts";
  import { exampleTouched, getExampleState, toneOf } from "./tone.ts";

  interface Props extends HTMLOutputAttributes {
    readonly result: AsyncResult.AsyncResult<unknown, unknown>;
    /** Set to false when another part of the example plays the outcome cues. */
    readonly sound?: boolean;
  }

  const { result, sound = true, ...rest }: Props = $props();

  const example = getExampleState();
  const tone = $derived(toneOf(result));

  // Plays a cue when a run ends: waiting goes from true to false, or the tag changes without one.
  let previous: { tag: string; waiting: boolean } | undefined;
  $effect(() => {
    const now = { tag: result._tag, waiting: result.waiting };
    const before = previous;
    previous = now;
    if (!(before && sound && exampleTouched(example)) || now.waiting) {
      return;
    }
    if (before.waiting || before.tag !== now.tag) {
      if (now.tag === "Success") {
        play("success");
      } else if (now.tag === "Failure") {
        play(tone === "interrupted" ? "interrupt" : "failure");
      }
    }
  });

  // On a change of state the badge gives a little bounce and its new icon pops in with a spring.
  const change = onChange(
    () => `${result._tag} ${result.waiting}`,
    (badge) => {
      if (reducedMotion()) {
        return;
      }
      animate(badge, { scale: [0.92, 1] }, springs.bouncy);
      const icon = badge.querySelector(".icon");
      if (icon) {
        animate(icon, { rotate: [-30, 0], scale: [0.3, 1] }, springs.snappy);
      }
    }
  );
</script>

<output
  class="badge"
  data-state={result._tag}
  data-tone={tone}
  data-waiting={result.waiting}
  {...rest}
  {@attach change}
>
  <!-- A first run has no state to show yet, only the spinner. -->
  <span aria-hidden="true" class="icon" hidden={tone === "running"}>
    {#if result._tag === "Success"}
      <CheckIcon strokeWidth={3} />
    {:else if result._tag === "Failure"}
      <XIcon strokeWidth={3} />
    {:else}
      <CircleIcon strokeWidth={3} />
    {/if}
  </span>
  {#if result.waiting}
    <span aria-hidden="true" class="spinner"><LoaderIcon strokeWidth={2.5} /></span>
  {/if}
  <span
    >{result._tag}{tone === "interrupted" ? ", interrupted" : ""}{result.waiting
      ? ", waiting"
      : ""}</span
  >
</output>

<style>
  .badge {
    --mark: var(--tone-idle);
    --text: var(--tone-idle-text);
    align-items: center;
    background: color-mix(in oklab, var(--mark) 12%, var(--background));
    border: 1px solid color-mix(in oklab, var(--mark) 45%, transparent);
    border-radius: 999px;
    color: var(--text);
    display: inline-flex;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    font-weight: 600;
    gap: 0.35rem;
    line-height: 1.5rem;
    padding: 0 0.6rem 0 0.45rem;
    transition:
      background-color 200ms,
      border-color 200ms,
      color 200ms;
    vertical-align: middle;
    white-space: nowrap;
  }
  .badge[data-tone="success"] {
    --mark: var(--tone-success);
    --text: var(--tone-success-text);
  }
  .badge[data-tone="failure"] {
    --mark: var(--tone-failure);
    --text: var(--tone-failure-text);
  }
  .badge[data-tone="interrupted"] {
    --mark: var(--tone-interrupted);
    --text: var(--tone-interrupted-text);
    border-style: dashed;
  }
  .badge[data-tone="running"] {
    --mark: var(--tone-running);
    --text: var(--tone-running-text);
  }
  .icon,
  .spinner {
    display: inline-flex;
  }
  .icon[hidden] {
    display: none;
  }
  .icon :global(svg),
  .spinner :global(svg) {
    height: 0.85rem;
    width: 0.85rem;
  }
  .icon {
    color: var(--mark);
  }
  .spinner {
    animation: spin 0.8s linear infinite;
    color: var(--tone-running);
  }
  @keyframes spin {
    to {
      transform: rotate(1turn);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }
  }
</style>
