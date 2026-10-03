<script lang="ts">
  import { Counter } from "./counter-scope.ts";
  import ScopedCounterButton from "./scoped-counter-button.svelte";

  const { label, start }: { label: string; start: number } = $props();
  // svelte-ignore state_referenced_locally
  Counter.provide(start);
</script>

<div style="border: 1px dashed #a1a1aa; padding: 0.5rem">
  <strong>{label}</strong>
  <ScopedCounterButton />
  <ScopedCounterButton />
</div>
