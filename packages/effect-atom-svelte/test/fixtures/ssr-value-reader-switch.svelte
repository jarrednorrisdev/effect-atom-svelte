<!-- value-reader-switch.svelte in a provider, for server rendering and hydration. -->
<script lang="ts">
  import { RegistryProvider } from "../../src/index.ts";
  import ValueReaderSwitch from "./value-reader-switch.svelte";
</script>

<RegistryProvider>
  <ValueReaderSwitch />
</RegistryProvider>
