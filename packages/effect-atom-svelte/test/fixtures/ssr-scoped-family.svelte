<!-- Two providers of one id, one of them remountable with {#key}, and a third id. Each provides the
     family's atom for its id, so both "a" providers hold the same atom. -->
<script lang="ts">
  import { RegistryProvider } from "../../src/index.ts";
  import FamilyUserProvider from "./family-user-provider.svelte";
  import FamilyUserReader from "./family-user-reader.svelte";

  let generation = $state(0);
</script>

<RegistryProvider>
  <button onclick={() => (generation += 1)}>remount</button>
  <svelte:boundary>
    {#key generation}
      <FamilyUserProvider id="a"><FamilyUserReader /></FamilyUserProvider>
    {/key}
    <FamilyUserProvider id="a"><FamilyUserReader /></FamilyUserProvider>
    <FamilyUserProvider id="b"><FamilyUserReader /></FamilyUserProvider>
    {#snippet failed(error)}
      <output>failed: {(error as Error).message}</output>
    {/snippet}
  </svelte:boundary>
</RegistryProvider>
