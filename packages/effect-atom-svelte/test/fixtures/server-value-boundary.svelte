<!-- A pending server value read by useAtomSuspense inside a boundary with a pending snippet (JND-58). -->
<script lang="ts">
  import { RegistryProvider } from "../../src/index.ts";
  import ServerValueSuspense from "./server-value-suspense.svelte";
</script>

<RegistryProvider>
  <svelte:boundary>
    <ServerValueSuspense />
    {#snippet pending()}
      <p>loading</p>
    {/snippet}
  </svelte:boundary>
</RegistryProvider>
