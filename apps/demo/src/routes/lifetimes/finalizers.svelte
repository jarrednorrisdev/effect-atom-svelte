<script module lang="ts">
  import { Atom } from "effect/reactivity";

  import { startTimer, stopTimer } from "./timers.svelte.ts";

  // The example's switch: leave the finalizer out to see what it prevents.
  let withFinalizer = true;

  const everyAtom = Atom.make(1000);

  // Counts ticks. Each computation starts a timer, and its finalizer stops it.
  // startTimer and stopTimer are setInterval and clearInterval, drawn below.
  const ticksAtom = Atom.make((get) => {
    let ticks = 0;
    const tick = () => {
      ticks += 1;
      get.setSelf(ticks);
    };
    const timer = startTimer(tick, get(everyAtom));
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

  const every = useAtom(everyAtom);
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
  <div aria-label="Tick every" class="flex gap-2" role="group">
    <button
      aria-pressed={every.current === 1000}
      onclick={() => (every.current = 1000)}
    >
      1 s
    </button>
    <button
      aria-pressed={every.current === 250}
      onclick={() => (every.current = 250)}
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
    {#if shown}<Reader atom={ticksAtom} />{:else}<p class="m-0">Clock hidden.</p>{/if}
  </div>
  <TimersPanel {shown} />
</div>
