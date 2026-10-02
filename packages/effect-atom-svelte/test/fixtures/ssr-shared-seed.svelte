<!-- Two components share one serialization key. The first shows it; the second shows it only when
     asked, so nothing but the seed's mount holds the atom once the first is destroyed (JND-36).
     Both can be removed and the first shown again, to check a seed nobody took is dropped (JND-37). -->
<script lang="ts">
  import { RegistryProvider } from "../../src/index.ts";
  import SeededReader from "./seeded-reader.svelte";

  let showFirst = $state(true);
  let showSecond = $state(false);
  let keepSecond = $state(true);
</script>

<RegistryProvider>
  <button onclick={() => (showFirst = false)}>hide first</button>
  <button onclick={() => (showFirst = true)}>show first</button>
  <button onclick={() => (showSecond = true)}>show second</button>
  <button onclick={() => (keepSecond = false)}>remove second</button>
  {#if showFirst}
    <SeededReader show />
  {/if}
  {#if keepSecond}
    <SeededReader show={showSecond} />
  {/if}
</RegistryProvider>
