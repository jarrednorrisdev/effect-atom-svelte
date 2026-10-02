<!-- Many readers of shared atom chains under one boundary, which records every error it catches. -->
<script lang="ts">
  import type { AtomRegistry } from "effect/reactivity";

  import { provideRegistry, useAtomSet } from "../../src/index.ts";
  import StressAsyncReader from "./stress-async-reader.svelte";
  import StressReader from "./stress-reader.svelte";
  import type { StressAtoms } from "./stress.ts";

  interface Props {
    readonly atoms: StressAtoms;
    readonly registry: AtomRegistry.AtomRegistry;
    readonly readers: number;
    readonly errors: unknown[];
  }

  const { atoms, errors, readers, registry }: Props = $props();
  // svelte-ignore state_referenced_locally
  provideRegistry({ registry });
  // svelte-ignore state_referenced_locally
  const setClicks = useAtomSet(atoms.clicks);
  const ids = $derived(Array.from({ length: readers }, (_, id) => id));
</script>

<button onclick={() => setClicks((n) => n + 1)}>click</button>
<svelte:boundary onerror={(error) => errors.push(error)}>
  {#each ids as id (id)}
    <StressReader {atoms} {id} />
    <StressAsyncReader {atoms} {id} />
  {/each}
  {#snippet pending()}
    <output>pending</output>
  {/snippet}
  {#snippet failed(error)}
    <output>failed: {String(error)}</output>
  {/snippet}
</svelte:boundary>
