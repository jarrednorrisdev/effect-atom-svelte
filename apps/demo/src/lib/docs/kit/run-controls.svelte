<!--
  @component
  Run, Interrupt and Reset for something the reader starts and may stop, after the tiles on
  effect.kitlangton.com. One button runs, and turns into Interrupt while running (it stays the
  same element, so keyboard focus stays on it). Reset appears only with `onreset`. Each button
  plays its cue (`start`, `interrupt`, `reset`).

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
</script>

<span class="controls">
  <button
    class={["control", interrupting && "stop"]}
    data-cue={interrupting ? "interrupt" : "start"}
    disabled={disabled || (running && !oninterrupt)}
    onclick={() => (interrupting ? oninterrupt?.() : onrun())}
    type="button"
  >
    {#if interrupting}
      <StopIcon aria-hidden="true" class="icon" />Interrupt
    {:else}
      <PlayIcon aria-hidden="true" class="icon" />{runLabel}
    {/if}
  </button>
  {#if onreset}
    <button class="control" data-cue="reset" {disabled} onclick={onreset} type="button">
      <ResetIcon aria-hidden="true" class="icon" />Reset
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
  .stop :global(.icon) {
    color: var(--tone-failure-text);
    fill: currentcolor;
  }
</style>
