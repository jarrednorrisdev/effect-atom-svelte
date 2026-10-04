<!--
  @component
  Plays a sound cue each time `on` changes, such as `tick` for each item a stream emits. It renders
  nothing. It stays silent on first render and until the reader has used the example, so a value
  that changes on a timer by itself (a clock) makes no sound until the reader has touched it.

  ```svelte
  <Cue cue="tick" on={clock.current} />
  ```
-->
<script lang="ts">
  import type { Cue } from "./sound.ts";
  import { play } from "./sound.ts";
  import { exampleTouched, getExampleState } from "./tone.ts";

  interface Props {
    readonly cue: Cue;
    /** The value to follow; every change plays the cue. */
    readonly on: unknown;
  }

  const { cue, on }: Props = $props();

  const example = getExampleState();
  let seen = false;
  $effect(() => {
    // Read to track it.
    void on;
    if (!seen) {
      seen = true;
      return;
    }
    if (exampleTouched(example)) {
      play(cue);
    }
  });
</script>
