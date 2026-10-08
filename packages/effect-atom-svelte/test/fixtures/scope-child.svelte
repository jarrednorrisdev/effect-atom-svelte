<script lang="ts">
  import type { InspectorScope } from "../../src/Inspector.ts";
  import { provideInspectorScope } from "../../src/Inspector.ts";
  import ScopeReader from "./scope-reader.svelte";

  const { onscope, shown }: {
    readonly onscope: (scope: InspectorScope) => void;
    readonly shown: boolean;
  } = $props();
  // svelte-ignore state_referenced_locally
  onscope(provideInspectorScope());
</script>

{#if shown}
  <ScopeReader />
{/if}
