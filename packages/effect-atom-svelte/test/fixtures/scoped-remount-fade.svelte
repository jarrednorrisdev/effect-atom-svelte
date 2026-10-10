<!-- As ssr-scoped-remount.svelte, but the remounted provider fades out, so the old branch stays
     alive beside the new one until its outro ends. -->
<script lang="ts">
  import { fade } from "svelte/transition";

  import { RegistryProvider } from "../../src/index.ts";
  import ScopedUserProvider from "./scoped-user-provider.svelte";
  import ScopedUserReader from "./scoped-user-reader.svelte";

  let generation = $state(0);
</script>

<RegistryProvider>
  <button onclick={() => (generation += 1)}>remount</button>
  <svelte:boundary>
    {#key generation}
      <div transition:fade={{ duration: 100 }}>
        <ScopedUserProvider id="a"><ScopedUserReader /></ScopedUserProvider>
      </div>
    {/key}
    {#snippet failed(error)}
      <output>failed: {(error as Error).message}</output>
    {/snippet}
  </svelte:boundary>
</RegistryProvider>
