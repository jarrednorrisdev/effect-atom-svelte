<!-- Two components share one serialization key: the first asks for it to run again once hydrated,
     the second doesn't. The first can be destroyed, as before its seed lands. -->
<script lang="ts">
  import { RegistryProvider } from "../../src/index.ts";
  import RevalidatingReader from "./revalidating-reader.svelte";

  let showFirst = $state(true);
</script>

<RegistryProvider>
  <button onclick={() => (showFirst = false)}>hide first</button>
  {#if showFirst}
    <RevalidatingReader revalidate />
  {/if}
  <RevalidatingReader revalidate={false} />
</RegistryProvider>
