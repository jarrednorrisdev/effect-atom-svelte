<!-- A defect atom whose hook is called after a top-level await, rendered and hydrated. -->
<script lang="ts">
  import { RegistryProvider } from "../../src/index.ts";
  import UnsentAfterAwaitReader from "./unsent-after-await-reader.svelte";
</script>

<RegistryProvider>
  <UnsentAfterAwaitReader />
</RegistryProvider>
