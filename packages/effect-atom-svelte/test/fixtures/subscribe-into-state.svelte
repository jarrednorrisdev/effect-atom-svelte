<!-- Mirrors one atom into component $state with useAtomSubscribe, as a toast or a local copy would,
     and reads another through a $derived once `show` is true. -->
<script lang="ts">
  import type { Atom, AtomRegistry } from "effect/reactivity";

  import {
    provideRegistry,
    useAtomSubscribe,
    useAtomValue,
  } from "../../src/index.ts";

  interface Props {
    readonly registry: AtomRegistry.AtomRegistry;
    readonly watched: Atom.Atom<unknown>;
    readonly read: Atom.Atom<unknown>;
    readonly show: boolean;
  }

  const { read, registry, show, watched }: Props = $props();
  // svelte-ignore state_referenced_locally
  provideRegistry({ registry });
  let last = $state("none");
  // svelte-ignore state_referenced_locally
  useAtomSubscribe(watched, (value) => {
    last = String(value);
  });
  // svelte-ignore state_referenced_locally
  const value = useAtomValue(read);
  const shown = $derived(show ? String(value.current) : "hidden");
</script>

<svelte:boundary>
  <output>{last} {shown}</output>
  {#snippet failed(error)}
    <output>failed: {error instanceof Error ? error.message : String(error)}</output>
  {/snippet}
</svelte:boundary>
