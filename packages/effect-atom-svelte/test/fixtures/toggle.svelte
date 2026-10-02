<!-- Mounts Harness only while `show` is true, to test cleanup on unmount. -->
<script lang="ts">
  import type { AtomRegistry } from "effect/reactivity";

  import Harness from "./harness.svelte";

  interface Props {
    readonly setup: () => unknown;
    readonly registry: AtomRegistry.AtomRegistry;
    readonly show: boolean;
    readonly async?: boolean | undefined;
  }

  const { async, registry, setup, show }: Props = $props();
</script>

{#if show}
  <Harness {async} {registry} {setup} />
{/if}
