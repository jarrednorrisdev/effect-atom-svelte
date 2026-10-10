<!-- A layout's reader above a page's HydrationBoundary that is shown while `show` is true. -->
<script lang="ts">
  import type { AtomRegistry, Hydration } from "effect/reactivity";

  import { HydrationBoundary, provideRegistry } from "../../src/index.ts";
  import Run from "./run.svelte";

  interface Props {
    readonly above: () => unknown;
    readonly registry: AtomRegistry.AtomRegistry;
    readonly show: boolean;
    readonly state: Iterable<Hydration.DehydratedAtom> | undefined;
  }

  const { above, registry, show, state }: Props = $props();
  // svelte-ignore state_referenced_locally
  provideRegistry({ registry });
</script>

<Run setup={above} />
{#if show}
  <HydrationBoundary {state}>
    <span>page</span>
  </HydrationBoundary>
{/if}
