<script lang="ts">
  import Part from "#lib/docs/kit/part.svelte";
  import Seconds from "./seconds.svelte";

  // While nobody reads clockAtom, its stream isn't running.
  let reading = $state(true);
</script>

<p>
  <button
    data-cue={reading ? "interrupt" : "start"}
    onclick={() => (reading = !reading)}
  >
    {reading ? "Stop reading" : "Start reading"}
  </button>
</p>
<Part dashed={!reading} label="Reader" tone={reading ? "running" : "idle"}>
  {#if reading}
    <Seconds />
  {:else}
    <p data-testid="clock-stopped">
      Nothing reads clockAtom, so its stream has stopped.
    </p>
  {/if}
</Part>
