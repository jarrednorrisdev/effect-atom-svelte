<script lang="ts">
  import Forecast from "./forecast.svelte";

  // While nothing reads forecastAtom, the registry disposes of it, so each
  // mount loads it again.
  let mounted = $state(false);
</script>

<p>
  <button
    aria-pressed={mounted}
    data-cue={mounted ? "reset" : "start"}
    onclick={() => (mounted = !mounted)}
  >
    Mount the forecast
  </button>
</p>
{#if mounted}
  <Forecast />
{:else}
  <p>Not mounted.</p>
{/if}
