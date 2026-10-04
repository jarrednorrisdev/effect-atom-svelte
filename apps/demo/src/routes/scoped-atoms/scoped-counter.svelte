<script lang="ts">
  import Part from "#lib/docs/kit/part.svelte";

  import { Counter } from "./counter-scope.ts";
  import ScopedCounterButton from "./scoped-counter-button.svelte";

  const { label, start }: { label: string; start: number } = $props();
  // svelte-ignore state_referenced_locally
  Counter.provide(start);
</script>

<Part code label="{label}: Counter.provide({start})">
  <ScopedCounterButton label="{label}, first" />
  <ScopedCounterButton label="{label}, second" />
</Part>
