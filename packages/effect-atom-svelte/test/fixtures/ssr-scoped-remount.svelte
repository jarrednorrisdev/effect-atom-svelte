<!-- A scoped, serializable atom per provider, with its input in the key. The provider can be
     remounted with {#key}, as a "reset" does. -->
<script lang="ts">
  import { RegistryProvider } from "../../src/index.ts";
  import ScopedUserProvider from "./scoped-user-provider.svelte";
  import ScopedUserReader from "./scoped-user-reader.svelte";

  let generation = $state(0);
</script>

<RegistryProvider>
  <button onclick={() => (generation += 1)}>remount</button>
  <svelte:boundary>
    {#key generation}
      <ScopedUserProvider id="a"><ScopedUserReader /></ScopedUserProvider>
    {/key}
    <ScopedUserProvider id="b"><ScopedUserReader /></ScopedUserProvider>
    {#snippet failed(error)}
      <output>failed: {(error as Error).message}</output>
    {/snippet}
  </svelte:boundary>
</RegistryProvider>
