<!-- A root layout giving a serializable atom an initial value, and a page hydrating its value. -->
<script lang="ts">
  import { HydrationBoundary, RegistryProvider } from "../../src/index.ts";
  import Reader from "./initial-seed-reader.svelte";
  import {
    initialSeedAtom,
    initialSeedState,
    initialSeedValue,
  } from "./initial-seed.ts";
</script>

<RegistryProvider initialValues={[[initialSeedAtom, initialSeedValue]]}>
  <HydrationBoundary state={initialSeedState}>
    <Reader />
  </HydrationBoundary>
</RegistryProvider>
