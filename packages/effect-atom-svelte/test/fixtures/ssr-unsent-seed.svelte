<!-- Serializable atoms whose server results aren't sent: a defect, and a value the schema rejects. -->
<script lang="ts">
  import { RegistryProvider } from "../../src/index.ts";
  import UnsentSeedReader from "./unsent-seed-reader.svelte";
</script>

<RegistryProvider>
  <UnsentSeedReader />
</RegistryProvider>
