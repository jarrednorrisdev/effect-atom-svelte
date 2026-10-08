<!-- Two HydrationBoundary instances given the same state, as a layout and its page might be. -->
<script lang="ts">
  import type { Atom, AtomRegistry, Hydration } from "effect/reactivity";

  import {
    HydrationBoundary,
    provideRegistry,
    useAtomValue,
  } from "../../src/index.ts";
  import Run from "./run.svelte";

  interface Props {
    readonly atom: Atom.Atom<number>;
    readonly registry: AtomRegistry.AtomRegistry;
    readonly state: Iterable<Hydration.DehydratedAtom> | undefined;
    readonly showFirst: boolean;
    readonly readSecond: boolean;
    /** The second boundary's state, if not the same as the first's. */
    readonly secondState?: Iterable<Hydration.DehydratedAtom> | undefined;
  }

  const { atom, readSecond, registry, secondState, showFirst, state }: Props =
    $props();
  // svelte-ignore state_referenced_locally
  provideRegistry({ registry });
</script>

{#if showFirst}
  <HydrationBoundary {state}>
    <p>first</p>
  </HydrationBoundary>
{/if}
<HydrationBoundary state={secondState ?? state}>
  {#if readSecond}
    <Run
      setup={() => {
        const value = useAtomValue(atom);
        return () => value.current;
      }}
    />
  {/if}
</HydrationBoundary>
