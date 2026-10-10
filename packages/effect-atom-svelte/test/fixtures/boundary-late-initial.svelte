<!-- A boundary whose content awaits before seeding an atom, and whose sibling may throw. -->
<script lang="ts">
  import type { Atom, AtomRegistry } from "effect/reactivity";

  import { provideRegistry } from "../../src/index.ts";
  import LateInitialReader from "./late-initial-reader.svelte";
  import Run from "./run.svelte";

  interface Props {
    readonly atom: Atom.Atom<string>;
    readonly registry: AtomRegistry.AtomRegistry;
    readonly value: string;
    readonly fail: boolean;
    readonly delay: number;
  }

  const { atom, delay, fail, registry, value }: Props = $props();
  // svelte-ignore state_referenced_locally
  provideRegistry({ registry });
</script>

<svelte:boundary>
  <LateInitialReader {atom} {delay} {value} />
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
