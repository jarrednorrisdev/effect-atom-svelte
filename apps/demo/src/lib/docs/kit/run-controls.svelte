<!--
  @component
  Run, Interrupt and Reset for something the reader starts and may stop, after the tiles on
  effect.kitlangton.com. One button runs, and turns into Interrupt while running (it stays the
  same element, so keyboard focus stays on it, and pops as it swaps). Reset appears only with
  `onreset` and spins its icon. Each button plays its cue (`start`, `interrupt`, `reset`).

  ```svelte
  <RunControls
    oninterrupt={() => cancel()}
    onreset={() => (result.current = Atom.Reset)}
    onrun={() => save(input)}
    running={result.current.waiting}
  />
  ```

  Only add Interrupt when stopping does something the reader can see; without `oninterrupt`, the
  run button is disabled while running.
-->
<script lang="ts">
  import PlayIcon from "@lucide/svelte/icons/play";
  import ResetIcon from "@lucide/svelte/icons/rotate-ccw";
  import StopIcon from "@lucide/svelte/icons/square";
  import { animate } from "motion";

  import { onChange, reducedMotion, springs } from "./motion.ts";

  interface Props {
    /** Disables every button, for example until a form is valid. */
    readonly disabled?: boolean;
    readonly oninterrupt?: () => void;
    readonly onreset?: () => void;
    readonly onrun: () => void;
    readonly running: boolean;
    /** The run button's label; "Run" by default. */
    readonly runLabel?: string;
  }

  const {
    disabled = false,
    oninterrupt,
    onreset,
    onrun,
    running,
    runLabel = "Run",
  }: Props = $props();

  const interrupting = $derived(running && oninterrupt !== undefined);

  // The run button pops when it turns into Interrupt and back, so the swap is noticed.
  const swap = onChange(
    () => interrupting,
    (button) => {
      if (!reducedMotion()) {
        animate(button, { scale: [0.9, 1] }, springs.bouncy);
      }
    }
  );

  let resetIcon = $state<HTMLElement>();
  const reset = () => {
    if (resetIcon && !reducedMotion()) {
      animate(resetIcon, { rotate: [0, -360] }, springs.bouncy);
    }
    onreset?.();
  };
</script>

<span class="controls">
  <button
    class={["control", interrupting && "stop"]}
    data-cue={interrupting ? "interrupt" : "start"}
    disabled={disabled || (running && !oninterrupt)}
    onclick={() => (interrupting ? oninterrupt?.() : onrun())}
    type="button"
    {@attach swap}
  >
    {#if interrupting}
      <StopIcon aria-hidden="true" class="icon" />Interrupt
    {:else}
      <PlayIcon aria-hidden="true" class="icon" />{runLabel}
    {/if}
  </button>
  {#if onreset}
    <button class="control" data-cue="reset" {disabled} onclick={reset} type="button">
      <span bind:this={resetIcon} class="icon-box">
        <ResetIcon aria-hidden="true" class="icon" />
      </span>
      Reset
    </button>
  {/if}
</span>

<style>
  .controls {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
  .control {
    align-items: center;
    display: inline-flex;
    gap: 0.4rem;
  }
  .control :global(.icon) {
    height: 0.9rem;
    width: 0.9rem;
  }
  .icon-box {
    display: inline-flex;
  }
  .stop :global(.icon) {
    color: var(--tone-failure-text);
    fill: currentcolor;
  }
</style>
