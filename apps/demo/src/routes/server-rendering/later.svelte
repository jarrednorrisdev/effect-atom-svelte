<script lang="ts">
  import type { AsyncResult, Atom } from "effect/reactivity";
  import { useAtomSuspense } from "effect-atom-svelte";
  import Origin from "#lib/docs/kit/origin.svelte";

  const { atom }: { atom: Atom.Atom<AsyncResult.AsyncResult<string>> } = $props();

  // Called inside the boundary, so the server, which renders only the pending
  // snippet, never runs it.
  const later = useAtomSuspense(() => atom);
</script>

<Origin where={await later.current} />
