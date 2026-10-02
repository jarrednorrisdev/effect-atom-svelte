<!-- Like ssr-hydrate.svelte, for useAtomResult with a getter. -->
<script lang="ts">
  import { RegistryProvider } from "../../src/index.ts";
  import SeededResult from "./seeded-result.svelte";
</script>

<RegistryProvider>
  <SeededResult />
</RegistryProvider>
