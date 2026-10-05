<!-- A stream atom still running when the server render ends. -->
<script lang="ts">
  import { RegistryProvider } from "../../src/index.ts";
  import StreamSeedReader from "./stream-seed-reader.svelte";
</script>

<RegistryProvider>
  <StreamSeedReader />
</RegistryProvider>
