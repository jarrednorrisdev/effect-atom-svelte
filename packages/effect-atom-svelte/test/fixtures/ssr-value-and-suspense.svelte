<!-- A serializable atom read with useAtomValue, as by a badge earlier in the page, and awaited with
     useAtomSuspense. -->
<script lang="ts">
  import { RegistryProvider } from "../../src/index.ts";
  import ValueAndSuspenseReader from "./value-and-suspense-reader.svelte";
</script>

<RegistryProvider>
  <ValueAndSuspenseReader />
</RegistryProvider>
