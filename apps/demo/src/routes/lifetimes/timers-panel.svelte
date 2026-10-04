<!--
  The finalizers example's timers, drawn from `timers.svelte.ts`: one row per timer ticksAtom
  started. The newest running timer is the one the clock uses; any other running timer is leaked,
  because nothing stopped it. Not part of the example's code.
-->
<script lang="ts">
  import Part from "#lib/docs/kit/part.svelte";

  import { timers } from "./timers.svelte.ts";

  interface Props {
    /** Whether the clock is shown, so its newest timer is in use. */
    readonly shown: boolean;
  }

  const { shown }: Props = $props();

  const running = $derived(timers.filter((timer) => !timer.stopped));
  const inUse = $derived(shown ? running.at(-1)?.id : undefined);
  const leaked = $derived(running.filter((timer) => timer.id !== inUse).length);

  const stateOf = (id: number, stopped: boolean) => {
    if (stopped) {
      return "stopped";
    }
    return id === inUse ? "running" : "leaked";
  };
</script>

<Part
  code
  count={running.length}
  countLabel="running"
  data-testid="timers"
  label="setInterval timers"
  tone={leaked > 0 ? "failure" : "idle"}
>
  {#if timers.length === 0}
    <p class="m-0 text-muted-foreground">None yet. Show the clock to start one.</p>
  {:else}
    <ul class="m-0 grid list-none gap-1 p-0">
      {#each timers as timer (timer.id)}
        {@const state = stateOf(timer.id, timer.stopped)}
        <li class="timer m-0" data-state={state}>
          <span aria-hidden="true" class="dot"></span>
          <span class="font-mono text-xs">
            timer {timer.id} · every {timer.every / 1000} s · {timer.ticks}
            {timer.ticks === 1 ? "tick" : "ticks"}
          </span>
          <span class="text-xs">
            {#if state === "stopped"}
              stopped by the finalizer
            {:else if state === "leaked"}
              leaked: still ticking, nothing uses it
            {:else}
              running for the clock
            {/if}
          </span>
        </li>
      {/each}
    </ul>
  {/if}
</Part>

<style>
  .timer {
    align-items: baseline;
    display: flex;
    flex-wrap: wrap;
    gap: 0 0.5rem;
  }
  .dot {
    align-self: center;
    background: var(--tone-interrupted);
    border-radius: 999px;
    flex: none;
    height: 0.5rem;
    width: 0.5rem;
  }
  .timer[data-state="stopped"] {
    color: var(--muted-foreground);
  }
  .timer[data-state="running"] .dot {
    animation: tick 1s ease-in-out infinite alternate;
    background: var(--tone-running);
  }
  .timer[data-state="leaked"] {
    color: var(--tone-failure-text);
  }
  .timer[data-state="leaked"] .dot {
    animation: tick 0.5s ease-in-out infinite alternate;
    background: var(--tone-failure);
  }
  @keyframes tick {
    from {
      opacity: 1;
    }
    to {
      opacity: 0.3;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .dot {
      animation: none !important;
    }
  }
</style>
