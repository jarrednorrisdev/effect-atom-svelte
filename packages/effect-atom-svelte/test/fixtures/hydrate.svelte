<!-- Renders HydrationBoundary around Run, inside a registry that the test controls. -->
<script lang="ts">
  import type { AtomRegistry, Hydration } from "effect/reactivity";

  import { HydrationBoundary, provideRegistry } from "../../src/index.ts";
  import Run from "./run.svelte";

  interface Props {
    readonly setup: () => unknown;
    readonly registry: AtomRegistry.AtomRegistry;
    readonly state: Iterable<Hydration.DehydratedAtom> | undefined;
  }

  const { registry, setup, state }: Props = $props();
  // svelte-ignore state_referenced_locally
  provideRegistry({ registry });
</script>

<HydrationBoundary {state}>
  <Run {setup} />
</HydrationBoundary>
