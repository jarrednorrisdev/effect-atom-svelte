<!-- Renders HydrationBoundary around an AsyncRun while `show` is true, inside a <svelte:boundary>
     that shows its pending snippet until the run has rendered. -->
<script lang="ts">
  import type { AtomRegistry, Hydration } from "effect/reactivity";

  import { HydrationBoundary, provideRegistry } from "../../src/index.ts";
  import AsyncRun from "./async-run.svelte";

  interface Props {
    readonly setup: () => unknown;
    readonly registry: AtomRegistry.AtomRegistry;
    readonly show: boolean;
    readonly state: Iterable<Hydration.DehydratedAtom> | undefined;
  }

  const { registry, setup, show, state }: Props = $props();
  // svelte-ignore state_referenced_locally
  provideRegistry({ registry });
</script>

<svelte:boundary>
  {#if show}
    <HydrationBoundary {state}>
      <AsyncRun {setup} />
    </HydrationBoundary>
  {/if}
  {#snippet pending()}
    <output>pending</output>
  {/snippet}
</svelte:boundary>
