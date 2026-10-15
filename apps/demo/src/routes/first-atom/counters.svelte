<script lang="ts">
  import Parts from "#lib/docs/kit/parts.svelte";

  import Counter from "./counter.svelte";

  let shown = $state(true);
</script>

<p>
  <button aria-pressed={shown} onclick={() => (shown = !shown)}>
    Show counters
  </button>
</p>

{#if shown}
  <Parts columns={2}>
    <Counter label="First counter" />
    <Counter label="Second counter" />
  </Parts>
{:else}
  <p>Nothing reads countAtom now, so its value is gone.</p>
{/if}
