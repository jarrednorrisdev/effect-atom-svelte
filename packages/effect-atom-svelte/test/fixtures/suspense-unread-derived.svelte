<!-- Reads useAtomSuspense's promise outside the markup: through a $derived only the script or an
     event handler reads, or in onDestroy. -->
<script lang="ts">
  import type { AsyncResult, Atom } from "effect/reactivity";
  import { onDestroy } from "svelte";

  import { useAtomSuspense } from "../../src/index.ts";

  interface Props {
    readonly atom: Atom.Atom<AsyncResult.AsyncResult<unknown, unknown>>;
    readonly mode: "script" | "handler" | "destroy";
  }

  const { atom, mode }: Props = $props();
  const value = useAtomSuspense(() => atom);
  const promise = $derived(value.current);
  const ignore = async (read: Promise<unknown>) => {
    try {
      await read;
    } catch {
      // Only the read matters here.
    }
  };
  // svelte-ignore state_referenced_locally
  if (mode === "script") {
    // svelte-ignore state_referenced_locally
    void ignore(promise);
  }
  onDestroy(() => {
    if (mode === "destroy") {
      void ignore(value.current);
    }
  });
</script>

<button onclick={() => void ignore(promise)}>Read</button>
