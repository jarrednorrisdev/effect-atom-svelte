<script module lang="ts">
  import { Atom } from "effect/reactivity";

  import { startTimer, stopTimer } from "./timers.svelte.ts";

  // The example's switch: leave the finalizer out to see what it prevents.
  let withFinalizer = true;

  // Milliseconds between ticks.
  const tickIntervalAtom = Atom.make(1000);

  // Counts ticks. Each computation starts a timer, and its finalizer stops it.
  // startTimer and stopTimer are setInterval and clearInterval, drawn below.
  const tickCountAtom = Atom.make((get) => {
    let ticks = 0;
    const tick = () => {
      ticks += 1;
      get.setSelf(ticks);
    };
    const timer = startTimer(tick, get(tickIntervalAtom));
    if (withFinalizer) {
      get.addFinalizer(() => stopTimer(timer));
    }
    return ticks;
  });
</script>

<script lang="ts">
  import { useAtom } from "effect-atom-svelte";

  import Reader from "./reader.svelte";
  import TimersPanel from "./timers-panel.svelte";
  import { resetTimers } from "./timers.svelte.ts";

  const tickInterval = useAtom(tickIntervalAtom);
  let shown = $state(false);
  let finalizer = $state(true);

  // Applies from the next computation: the current one already chose.
  const toggleFinalizer = () => {
    finalizer = !finalizer;
    withFinalizer = finalizer;
  };
  const reset = () => {
    shown = false;
    resetTimers();
  };
</script>

<div class="flex flex-wrap items-center gap-2">
  <button aria-pressed={shown} onclick={() => (shown = !shown)}>Show the clock</button>
  <div aria-label="tickIntervalAtom" class="flex items-center gap-2" role="group">
    <code class="text-xs">tickIntervalAtom</code>
    <button
      aria-pressed={tickInterval.current === 1000}
      onclick={() => (tickInterval.current = 1000)}
    >
      1 s
    </button>
    <button
      aria-pressed={tickInterval.current === 250}
      onclick={() => (tickInterval.current = 250)}
    >
      0.25 s
    </button>
  </div>
</div>
<div class="mt-2 flex flex-wrap items-center gap-2">
  <button aria-pressed={finalizer} onclick={toggleFinalizer}>
    Clear in a finalizer
  </button>
  <button data-cue="reset" onclick={reset}>Reset</button>
</div>
<div class="mt-3 grid gap-3 sm:grid-cols-[10rem_1fr]">
  <div>
    {#if shown}
      <Reader atom={tickCountAtom} />
    {:else}
      <p class="m-0">Clock hidden.</p>
    {/if}
  </div>
  <TimersPanel {shown} />
</div>
