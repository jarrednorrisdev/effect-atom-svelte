<!-- Reads an atom with useAtomValue in an $effect only, counting the effect's runs. -->
<script lang="ts">
  import type { Atom, AtomRegistry } from "effect/reactivity";

  import { provideRegistry, useAtomValue } from "../../src/index.ts";

  interface Props {
    readonly atom: Atom.Atom<unknown>;
    readonly registry: AtomRegistry.AtomRegistry;
    readonly seen: unknown[];
  }

  const { atom, registry, seen }: Props = $props();
  // svelte-ignore state_referenced_locally
  provideRegistry({ registry });
  // svelte-ignore state_referenced_locally
  const value = useAtomValue(atom);
  $effect(() => {
    seen.push(value.current);
  });
</script>

<output>ok</output>
