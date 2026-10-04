<!--
  @component
  Play and Restart for a scripted simulation, as in Effect's Module of the Week posts. Play is
  disabled while the simulation plays (its icon beats meanwhile); Restart spins its icon, puts the
  simulation back to the start and plays it again. Pair
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
  import { animate } from "motion";

  import { reducedMotion, springs } from "./motion.ts";

  interface Props {
    readonly onplay: () => void;
    readonly onrestart: () => void;
    readonly playing: boolean;
    /** The play button's label; "Play" by default. */
    readonly playLabel?: string;
  }

  const { onplay, onrestart, playing, playLabel = "Play" }: Props = $props();

  // While the story plays, the play icon beats, so a disabled Play still says "running".
  const beat = (icon: HTMLElement) => {
    if (!playing || reducedMotion()) {
      return undefined;
    }
    const pulse = animate(
      icon,
      { scale: [1, 1.3, 1] },
      { duration: 0.8, ease: "easeInOut", repeat: Number.POSITIVE_INFINITY }
    );
    return () => {
      pulse.stop();
      animate(icon, { scale: 1 }, springs.snappy);
    };
  };

  let restartIcon = $state<HTMLElement>();
  const restart = () => {
    if (restartIcon && !reducedMotion()) {
      animate(restartIcon, { rotate: [0, -360] }, springs.bouncy);
    }
    onrestart();
  };
</script>

<span class="controls">
  <button class="control" data-cue="start" disabled={playing} onclick={onplay} type="button">
    <span class="icon-box" {@attach beat}><PlayIcon aria-hidden="true" class="icon" /></span>
    {playLabel}
  </button>
  <button class="control" data-cue="reset" onclick={restart} type="button">
    <span bind:this={restartIcon} class="icon-box">
      <RestartIcon aria-hidden="true" class="icon" />
    </span>
    Restart
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
  .icon-box {
    display: inline-flex;
  }
</style>
