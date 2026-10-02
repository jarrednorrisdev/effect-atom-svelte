<!-- Mounts ScriptAwait only while `show` is true, to test unmounting while its script awaits. -->
<script lang="ts">
  import type { AtomRegistry } from "effect/reactivity";

  import { provideRegistry } from "../../src/index.ts";
  import ScriptAwait from "./script-await.svelte";

  interface Props {
    readonly setup: () => Promise<unknown>;
    readonly registry: AtomRegistry.AtomRegistry;
    readonly show: boolean;
  }

  const { registry, setup, show }: Props = $props();
  // svelte-ignore state_referenced_locally
  provideRegistry({ registry });
</script>

<svelte:boundary>
  {#if show}
    <ScriptAwait {setup} />
  {/if}
  {#snippet pending()}
    <output>pending</output>
  {/snippet}
</svelte:boundary>
