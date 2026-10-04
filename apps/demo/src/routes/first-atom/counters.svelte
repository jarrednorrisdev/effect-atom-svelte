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
  <div class="flex flex-wrap gap-3">
    <Counter label="First counter" />
    <Counter label="Second counter" />
  </div>
{:else}
  <p>Nothing reads countAtom now, so its value is gone.</p>
{/if}
