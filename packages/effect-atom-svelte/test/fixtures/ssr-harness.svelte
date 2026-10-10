<!-- No pending snippet: with one, SSR would render it instead of awaiting the content. -->
<script lang="ts">
  import type { AtomRegistry } from "effect/reactivity";

  import { provideRegistry } from "../../src/index.ts";
  import AsyncRun from "./async-run.svelte";
  import MarkupRun from "./markup-run.svelte";

  interface Props {
    readonly setup: () => unknown;
    readonly registry?: AtomRegistry.AtomRegistry | undefined;
    /** Await the view in the markup straight away, rather than `setup` in the script first. */
    readonly markup?: boolean | undefined;
  }

  const { markup = false, registry, setup }: Props = $props();
  // svelte-ignore state_referenced_locally
  provideRegistry({ registry });
</script>

{#if markup}
  <MarkupRun {setup} />
{:else}
  <AsyncRun {setup} />
{/if}
