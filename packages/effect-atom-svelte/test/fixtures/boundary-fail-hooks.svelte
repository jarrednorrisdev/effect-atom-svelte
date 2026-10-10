<!-- Runs `setup` under a HydrationBoundary inside a boundary whose next component throws while it
     sets up, so Svelte's server renderer drops the content, onDestroy callbacks included. -->
<script lang="ts">
  import type { AtomRegistry, Hydration } from "effect/reactivity";

  import { HydrationBoundary, provideRegistry } from "../../src/index.ts";
  import Run from "./run.svelte";

  interface Props {
    readonly setup: () => unknown;
    readonly registry: AtomRegistry.AtomRegistry;
    readonly state: Iterable<Hydration.DehydratedAtom>;
  }

  const { registry, setup, state }: Props = $props();
  // svelte-ignore state_referenced_locally
  provideRegistry({ registry });
</script>

<svelte:boundary>
  <HydrationBoundary {state}>
    <Run {setup} />
    <Run
      setup={() => {
        throw new Error("a later component fails");
      }}
    />
  </HydrationBoundary>
  {#snippet failed()}
    <p>failed</p>
  {/snippet}
</svelte:boundary>
