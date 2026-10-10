<!-- Reads an atom through a transform in an $effect only, recording what each run sees. -->
<script lang="ts">
  import type { Atom, AtomRegistry } from "effect/reactivity";

  import { provideRegistry, useAtomValue } from "../../src/index.ts";

  interface Props {
    readonly atom: Atom.Atom<number>;
    readonly registry: AtomRegistry.AtomRegistry;
    readonly seen: unknown[];
    readonly calls: number[];
  }

  const { atom, registry, seen, calls }: Props = $props();
  // svelte-ignore state_referenced_locally
  provideRegistry({ registry });
  // svelte-ignore state_referenced_locally
  const boxed = useAtomValue(atom, (n) => {
    calls.push(n);
    return { n };
  });
  $effect(() => {
    seen.push(boxed.current);
  });
</script>

<output>ok</output>
