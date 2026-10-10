<!-- A RegistryProvider inside a boundary whose content may throw. -->
<script lang="ts">
  import { RegistryProvider } from "../../src/index.ts";
  import Run from "./run.svelte";

  interface Props {
    readonly setup: () => unknown;
    readonly fail: boolean;
  }

  const { fail, setup }: Props = $props();
</script>

<svelte:boundary>
  <RegistryProvider>
    <Run {setup} />
  </RegistryProvider>
  {#if fail}
    <Run
      setup={() => {
        throw new Error("a later component fails");
      }}
    />
  {/if}
  {#snippet failed()}
    <p>failed</p>
  {/snippet}
</svelte:boundary>
