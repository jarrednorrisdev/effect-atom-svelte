<!-- A root layout giving a serializable atom an initial value, and a page awaiting it. -->
<script lang="ts">
  import { RegistryProvider } from "../../src/index.ts";
  import Reader from "./initial-seed-reader.svelte";
  import { initialSeedAtom, initialSeedValue } from "./initial-seed.ts";
</script>

<RegistryProvider initialValues={[[initialSeedAtom, initialSeedValue]]}>
  <Reader />
</RegistryProvider>
