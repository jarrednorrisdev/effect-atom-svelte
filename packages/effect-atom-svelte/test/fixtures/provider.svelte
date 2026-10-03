<!-- Runs `setup` inside a RegistryProvider given the test's options. -->
<script lang="ts">
  import type { ProvideRegistryOptions } from "../../src/RegistryContext.ts";
  import { RegistryProvider } from "../../src/index.ts";
  import Run from "./run.svelte";

  type Props = ProvideRegistryOptions & { readonly setup: () => unknown };

  const props: Props = $props();
</script>

<RegistryProvider {...props}>
  <Run setup={props.setup} />
</RegistryProvider>
