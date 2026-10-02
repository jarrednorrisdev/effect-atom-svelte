<!-- No pending snippet: with one, SSR would render it instead of awaiting the content. -->
<script lang="ts">
  import type { AtomRegistry } from "effect/reactivity";

  import { provideRegistry } from "../../src/index.ts";
  import AsyncRun from "./async-run.svelte";

  interface Props {
    readonly setup: () => unknown;
    readonly registry?: AtomRegistry.AtomRegistry | undefined;
  }

  const { registry, setup }: Props = $props();
  // svelte-ignore state_referenced_locally
  provideRegistry({ registry });
</script>

<AsyncRun {setup} />
