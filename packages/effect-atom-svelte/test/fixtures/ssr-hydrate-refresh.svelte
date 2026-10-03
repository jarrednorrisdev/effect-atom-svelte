<!-- A seeded atom refreshed after hydration. -->
<script lang="ts">
  import { RegistryProvider } from "../../src/index.ts";
  import SeededRefresh from "./seeded-refresh.svelte";
</script>

<RegistryProvider>
  <SeededRefresh />
</RegistryProvider>
