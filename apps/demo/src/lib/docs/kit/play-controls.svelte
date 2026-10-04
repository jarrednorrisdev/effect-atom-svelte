<!--
  @component
  Play and Restart for a scripted simulation, as in Effect's Module of the Week posts. Play is
  disabled while the simulation plays; Restart puts it back to the start and plays it again. Pair
  it with `Simulation` from `simulation.svelte.ts`:

  ```svelte
  <PlayControls
    onplay={() => sim.play()}
    onrestart={() => sim.restart()}
    playing={sim.playing}
  />
  ```

  Only use it when the example has a story to replay. Something the reader drives directly
  (a counter, a form) needs no Play button.
-->
<script lang="ts">
  import PlayIcon from "@lucide/svelte/icons/play";
  import RestartIcon from "@lucide/svelte/icons/rotate-ccw";

  interface Props {
    readonly onplay: () => void;
    readonly onrestart: () => void;
    readonly playing: boolean;
    /** The play button's label; "Play" by default. */
    readonly playLabel?: string;
  }

  const { onplay, onrestart, playing, playLabel = "Play" }: Props = $props();
</script>

<span class="controls">
  <button class="control" data-cue="start" disabled={playing} onclick={onplay} type="button">
    <PlayIcon aria-hidden="true" class="icon" />{playLabel}
  </button>
  <button class="control" data-cue="reset" onclick={onrestart} type="button">
    <RestartIcon aria-hidden="true" class="icon" />Restart
  </button>
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
</style>
