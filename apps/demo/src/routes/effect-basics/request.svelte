<script lang="ts">
  import EventLog from "#lib/docs/kit/event-log.svelte";
  import Part from "#lib/docs/kit/part.svelte";
  import Reader, { server } from "./reader.svelte";

  // While nothing reads requestAtom, the registry disposes of it.
  let reading = $state(false);
</script>

<p>
  <button
    data-cue={reading ? "interrupt" : "start"}
    onclick={() => (reading = !reading)}
  >
    {reading ? "Remove the reader" : "Add a reader"}
  </button>
</p>
<Part code dashed={!reading} label="<Reader>" tone={reading ? "success" : "idle"}>
  {#if reading}
    <Reader />
  {:else}
    <p class="m-0">Nothing reads requestAtom.</p>
  {/if}
</Part>
<EventLog empty="No requests yet." entries={server.entries} label="Server" />
