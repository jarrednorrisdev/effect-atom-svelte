<script lang="ts">
  import ScopedCounter from "./scoped-counter.svelte";
</script>

<div style="display: flex; gap: 1rem">
  <ScopedCounter label="Left" start={0} />
  <ScopedCounter label="Right" start={100} />
</div>
