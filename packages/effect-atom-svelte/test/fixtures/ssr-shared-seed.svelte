<!-- Two components share one serialization key. The first shows it; the second shows it only when
     asked, so nothing but the seed's mount holds the atom once the first is destroyed (JND-36). -->
<script lang="ts">
  import { RegistryProvider } from "../../src/index.ts";
  import SeededReader from "./seeded-reader.svelte";

  let showFirst = $state(true);
  let showSecond = $state(false);
</script>

<RegistryProvider>
  <button onclick={() => (showFirst = false)}>hide first</button>
  <button onclick={() => (showSecond = true)}>show second</button>
  {#if showFirst}
    <SeededReader show />
  {/if}
  <SeededReader show={showSecond} />
</RegistryProvider>
