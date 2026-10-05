<!-- A serializable atom whose hook is called outside a boundary with a pending snippet and read
     inside it. The server renders the snippet instead of the read (JND-86). -->
<script lang="ts">
  import { RegistryProvider } from "../../src/index.ts";
  import PendingBoundaryReader from "./pending-boundary-reader.svelte";
</script>

<RegistryProvider>
  <PendingBoundaryReader />
</RegistryProvider>
