<script module lang="ts">
  import { Atom } from "effect/reactivity";
  import { EventLogState } from "#lib/docs/kit/event-log.svelte.ts";

  const log = new EventLogState();
  let started = 0;

  const everyAtom = Atom.make(1000);

  // Counts ticks. Each computation starts an interval; its finalizer clears it.
  const ticksAtom = Atom.make((get) => {
    const every = get(everyAtom);
    started += 1;
    const interval = started;
    let ticks = 0;
    const timer = setInterval(() => {
      ticks += 1;
      get.setSelf(ticks);
    }, every);
    log.add(`interval ${interval} started, every ${every} ms`, { tone: "running" });
    get.addFinalizer(() => {
      clearInterval(timer);
      log.add(`interval ${interval} cleared`, { tone: "interrupted" });
    });
    return ticks;
  });
</script>

<script lang="ts">
  import { useAtom } from "effect-atom-svelte";
  import EventLog from "#lib/docs/kit/event-log.svelte";
  import Part from "#lib/docs/kit/part.svelte";

  import Reader from "./reader.svelte";

  const every = useAtom(everyAtom);
  let shown = $state(false);

  // Intervals started minus intervals cleared: never more than one.
  const running = $derived(
    log.entries.filter((entry) => entry.label.includes("started")).length -
      log.entries.filter((entry) => entry.label.includes("cleared")).length
  );
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
<div class="mt-3">
  <Part
    code
    count={running}
    countLabel="intervals running"
    dashed={!shown}
    label="ticksAtom"
    tone={shown ? "running" : "idle"}
  >
    {#if shown}<Reader atom={ticksAtom} />{:else}Nothing reads it.{/if}
  </Part>
</div>
<EventLog
  code
  data-testid="finalizer-log"
  empty="Show the clock to start an interval."
  entries={log.entries}
  label="ticksAtom"
/>
