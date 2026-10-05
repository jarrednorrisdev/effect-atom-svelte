<!-- A serializable atom whose hook is called after a top-level await, rendered and hydrated (JND-85). -->
<script lang="ts">
  import { RegistryProvider } from "../../src/index.ts";
  import AfterAwaitReader from "./after-await-reader.svelte";
</script>

<RegistryProvider>
  <AfterAwaitReader />
</RegistryProvider>
