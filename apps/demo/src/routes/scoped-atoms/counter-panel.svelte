<script lang="ts">
  import Part from "#lib/docs/kit/part.svelte";
  import type { Snippet } from "svelte";

  import { Counter } from "./counter-scope.ts";
  import ScopedCounterButton from "./scoped-counter-button.svelte";

  const { children, label }: { children?: Snippet; label: string } = $props();

  // Every panel provides its own atom, even with the same input.
  Counter.provide(0);
</script>

<Part code label="{label}: Counter.provide(0)">
  <ScopedCounterButton {label} />
  <!-- A panel inside this one provides again, so its buttons find that atom. -->
  {@render children?.()}
</Part>
