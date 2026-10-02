<!-- Picks its atom from component $state, which Svelte can roll back, rather than from an atom. -->
<script lang="ts">
  import type { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";

  import { provideRegistry, useAtomSuspense } from "../../src/index.ts";

  interface Props {
    readonly registry: AtomRegistry.AtomRegistry;
    readonly named: (name: string) => Atom.Atom<AsyncResult.AsyncResult<string>>;
  }

  const { named, registry }: Props = $props();
  // svelte-ignore state_referenced_locally
  provideRegistry({ registry });
  let name = $state("a");
  const value = useAtomSuspense(() => named(name));
</script>

<button onclick={() => (name = "b")}>b</button>
<output>{await value.current}</output>
