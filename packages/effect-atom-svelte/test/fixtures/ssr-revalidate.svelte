<!-- Serializable atoms read with revalidateOnHydrate, rendered on the server and hydrated (JND-85). -->
<script lang="ts">
  import { RegistryProvider } from "../../src/index.ts";
  import RevalidateReader from "./revalidate-reader.svelte";
</script>

<RegistryProvider>
  <RevalidateReader />
</RegistryProvider>
