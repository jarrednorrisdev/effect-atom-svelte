<!-- A serializable atom whose seed the browser can't decode. -->
<script lang="ts">
  import { RegistryProvider } from "../../src/index.ts";
  import SkewSeedReader from "./skew-seed-reader.svelte";
</script>

<RegistryProvider>
  <svelte:boundary>
    <SkewSeedReader />
    {#snippet failed(error)}
      <output>failed: {error instanceof Error ? error.message.split("\n")[0] : String(error)}</output>
    {/snippet}
  </svelte:boundary>
</RegistryProvider>
