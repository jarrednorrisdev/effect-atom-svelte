<!-- Runs `setup` inside a RegistryProvider given the test's options. -->
<script lang="ts">
  import type { ProvideRegistryOptions } from "../../src/RegistryContext.ts";
  import { RegistryProvider } from "../../src/index.ts";
  import Run from "./run.svelte";

  interface Props extends ProvideRegistryOptions {
    readonly setup: () => unknown;
  }

  const { setup, ...options }: Props = $props();
</script>

<RegistryProvider {...options}>
  <Run {setup} />
</RegistryProvider>
