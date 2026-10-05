<!-- A city picked from component $state, read with useAtomSuspense and reloaded with useAtomRefresh (JND-93). -->
<script lang="ts">
  import type { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";

  import {
    provideRegistry,
    useAtomRefresh,
    useAtomSuspense,
  } from "../../src/index.ts";

  interface Props {
    readonly registry: AtomRegistry.AtomRegistry;
    readonly weather: (
      city: string
    ) => Atom.Atom<AsyncResult.AsyncResult<string, Error>>;
  }

  const { registry, weather }: Props = $props();
  // svelte-ignore state_referenced_locally
  provideRegistry({ registry });
  let city = $state("Paris");
  const forecast = useAtomSuspense(() => weather(city));
  const reload = useAtomRefresh(() => weather(city));
</script>

{#each ["Paris", "Tokyo", "Lima"] as name (name)}
  <button onclick={() => (city = name)}>{name}</button>
{/each}
<button onclick={reload}>Reload</button>
<svelte:boundary>
  <output>{city}: {await forecast.current}</output>
  {#snippet pending()}
    <output>pending</output>
  {/snippet}
  {#snippet failed(error)}
    <output>failed: {(error as Error).message}</output>
  {/snippet}
</svelte:boundary>
