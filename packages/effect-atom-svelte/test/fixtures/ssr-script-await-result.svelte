<!-- ScriptAwaitResultReader in its own registry. -->
<script lang="ts">
  import { RegistryProvider } from "../../src/index.ts";
  import ScriptAwaitResultReader from "./script-await-result-reader.svelte";
</script>

<RegistryProvider>
  <ScriptAwaitResultReader />
</RegistryProvider>
