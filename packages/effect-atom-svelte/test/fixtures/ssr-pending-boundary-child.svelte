<!-- The same atom with its hook in a component inside the boundary, so the server never calls it
     (JND-86). -->
<script lang="ts">
  import { RegistryProvider } from "../../src/index.ts";
  import PendingBoundaryInner from "./pending-boundary-inner.svelte";
</script>

<RegistryProvider>
  <svelte:boundary>
    <PendingBoundaryInner />
    {#snippet pending()}
      <p>loading</p>
    {/snippet}
  </svelte:boundary>
</RegistryProvider>
