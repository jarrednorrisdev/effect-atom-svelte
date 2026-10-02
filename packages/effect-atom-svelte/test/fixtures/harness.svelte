<!-- Gives each test its own registry and runs `setup` in a child, where hooks have component context. -->
<script lang="ts">
  import type { AtomRegistry } from "effect/reactivity";

  import { provideRegistry } from "../../src/index.ts";
  import AsyncRun from "./async-run.svelte";
  import Run from "./run.svelte";

  interface Props {
    readonly setup: () => unknown;
    readonly registry?: AtomRegistry.AtomRegistry | undefined;
    readonly async?: boolean | undefined;
  }

  const { async = false, registry, setup }: Props = $props();
  const describe = (error: unknown) =>
    typeof error === "object" && error !== null && "_tag" in error
      ? String(error._tag)
      : error instanceof Error
        ? error.message
        : String(error);
  // svelte-ignore state_referenced_locally
  provideRegistry({ registry });
</script>

<svelte:boundary>
  {#if async}
    <AsyncRun {setup} />
  {:else}
    <Run {setup} />
  {/if}
  {#snippet pending()}
    <output>pending</output>
  {/snippet}
  {#snippet failed(error)}
    <output>failed: {describe(error)}</output>
  {/snippet}
</svelte:boundary>
