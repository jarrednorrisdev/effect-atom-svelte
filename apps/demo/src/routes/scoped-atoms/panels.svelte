<script lang="ts">
  import ScopedCounter from "./scoped-counter.svelte";
</script>

<div class="flex flex-wrap gap-3">
  <ScopedCounter label="Left" start={0} />
  <ScopedCounter label="Right" start={100} />
</div>
