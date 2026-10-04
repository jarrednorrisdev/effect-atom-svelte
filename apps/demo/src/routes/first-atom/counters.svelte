<script lang="ts">
  import Counter from "./counter.svelte";

  let shown = $state(true);
</script>

<p>
  <button onclick={() => (shown = !shown)}>
    {shown ? "Hide counters" : "Show counters"}
  </button>
</p>

{#if shown}
  <Counter label="First counter" />
  <Counter label="Second counter" />
{/if}
