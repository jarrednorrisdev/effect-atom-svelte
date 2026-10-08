<!-- A page seeding an atom with useAtomInitialValues inside a boundary whose content may throw. -->
<script lang="ts">
  import type { Atom, AtomRegistry } from "effect/reactivity";

  import { provideRegistry, useAtomInitialValues, useAtomValue } from "../../src/index.ts";
  import Run from "./run.svelte";

  interface Props {
    readonly atom: Atom.Atom<string>;
    readonly registry: AtomRegistry.AtomRegistry;
    readonly value: string;
    readonly fail: boolean;
  }

  const { atom, fail, registry, value }: Props = $props();
  // svelte-ignore state_referenced_locally
  provideRegistry({ registry });
</script>

<svelte:boundary>
  <Run
    setup={() => {
      useAtomInitialValues([[atom, value]]);
      const read = useAtomValue(atom);
      return () => read.current;
    }}
  />
  {#if fail}
    <Run
      setup={() => {
        throw new Error("a later component fails");
      }}
    />
  {/if}
  {#snippet failed()}
    <p>failed</p>
  {/snippet}
</svelte:boundary>
