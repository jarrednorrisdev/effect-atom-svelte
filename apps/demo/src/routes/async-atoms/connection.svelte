<script lang="ts">
  import EventLog from "#lib/docs/kit/event-log.svelte";
  import Part from "#lib/docs/kit/part.svelte";
  import Feed, { server } from "./feed.svelte";

  // While nothing reads feedAtom, the registry disposes of it.
  let reading = $state(false);
</script>

<p>
  <button
    aria-pressed={reading}
    data-cue={reading ? "interrupt" : "start"}
    onclick={() => (reading = !reading)}
  >
    Read feedAtom
  </button>
</p>
<Part code dashed={!reading} label="<Feed>" tone={reading ? "success" : "idle"}>
  {#if reading}
    <Feed />
  {:else}
    <p data-testid="feed-gone">Nothing reads feedAtom.</p>
  {/if}
</Part>
<EventLog
  empty="No sockets yet."
  entries={server.entries}
  label="Socket server"
  max={8}
/>
