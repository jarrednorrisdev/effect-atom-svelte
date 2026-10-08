<!-- Like ssr-hydrate.svelte, for useAtomResult with a getter. The reader can be hidden, even while
     its script awaits. -->
<script lang="ts">
  import { RegistryProvider } from "../../src/index.ts";
  import SeededResult from "./seeded-result.svelte";

  let show = $state(true);
</script>

<RegistryProvider>
  {#if show}
    <SeededResult />
  {/if}
  <button onclick={() => (show = false)}>hide</button>
</RegistryProvider>
