<script lang="ts">
  import EventLog from "#lib/docs/kit/event-log.svelte";
  import Part from "#lib/docs/kit/part.svelte";

  import { streamLog } from "./clock.ts";
  import Reader from "./reader.svelte";

  // Which readers are mounted. While neither is, nothing reads clockAtom.
  const reading = $state({ A: true, B: false });
  const names = ["A", "B"] as const;
</script>

<div class="grid gap-3 sm:grid-cols-2">
  {#each names as name (name)}
    <Part
      dashed={!reading[name]}
      label="Reader {name}"
      tone={reading[name] ? "running" : "idle"}
      top
    >
      <button
        aria-pressed={reading[name]}
        data-cue={reading[name] ? "interrupt" : "start"}
        onclick={() => (reading[name] = !reading[name])}
      >
        Read clockAtom
      </button>
      <div class="mt-3">
        {#if reading[name]}
          <Reader {name} />
        {:else}
          <p class="m-0 text-muted-foreground">Not reading.</p>
        {/if}
      </div>
    </Part>
  {/each}
</div>
<div class="mt-3">
  <EventLog
    code
    data-testid="clock-log"
    empty="Nothing has started the stream yet."
    entries={streamLog.entries}
    label="clockAtom's stream"
    max={6}
  />
</div>
