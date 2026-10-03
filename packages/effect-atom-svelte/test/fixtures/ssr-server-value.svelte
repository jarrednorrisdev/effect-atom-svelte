<!-- Serializable atoms with server values, read by both async hooks (JND-58). -->
<script lang="ts">
  import { RegistryProvider } from "../../src/index.ts";
  import ServerValueReader from "./server-value-reader.svelte";
</script>

<RegistryProvider>
  <ServerValueReader />
</RegistryProvider>
