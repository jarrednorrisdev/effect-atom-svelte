<!-- Mounts suspense-unread-derived.svelte, in the test's registry, only while `show` is true. -->
<script lang="ts">
  import type { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";

  import { provideRegistry } from "../../src/index.ts";
  import Reader from "./suspense-unread-derived.svelte";

  interface Props {
    readonly atom: Atom.Atom<AsyncResult.AsyncResult<unknown, unknown>>;
    readonly mode: "script" | "handler" | "destroy";
    readonly registry: AtomRegistry.AtomRegistry;
    readonly show: boolean;
  }

  const { atom, mode, registry, show }: Props = $props();
  // svelte-ignore state_referenced_locally
  provideRegistry({ registry });
</script>

{#if show}
  <Reader {atom} {mode} />
{/if}
