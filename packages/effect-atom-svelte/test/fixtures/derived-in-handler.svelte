<!-- Reads an atom through $deriveds that only an event handler reads, never the markup. -->
<script lang="ts">
  import type { Atom, AtomRegistry } from "effect/reactivity";

  import { provideRegistry, useAtomValue } from "../../src/index.ts";

  interface Props {
    readonly registry: AtomRegistry.AtomRegistry;
    readonly atom: Atom.Atom<number>;
  }

  const { atom, registry }: Props = $props();
  // svelte-ignore state_referenced_locally
  provideRegistry({ registry });
  // svelte-ignore state_referenced_locally
  const plain = useAtomValue(atom);
  // svelte-ignore state_referenced_locally
  const mapped = useAtomValue(atom, (n) => n * 10);
  const plainDerived = $derived(plain.current);
  const mappedDerived = $derived(mapped.current);
  let shown = $state("");
</script>

<button onclick={() => (shown = `${plainDerived} ${mappedDerived}`)}>read</button>
<output>{shown}</output>
