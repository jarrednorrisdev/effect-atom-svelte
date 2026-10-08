<!-- ScriptReadReader in a registry the test can inspect (browser only; the server makes its own). -->
<script lang="ts">
  import type { AtomRegistry } from "effect/reactivity";

  import { RegistryProvider } from "../../src/index.ts";
  import ScriptReadReader from "./script-read-reader.svelte";

  const { registry }: { registry?: AtomRegistry.AtomRegistry | undefined } =
    $props();
</script>

<RegistryProvider {registry}>
  <ScriptReadReader />
</RegistryProvider>
