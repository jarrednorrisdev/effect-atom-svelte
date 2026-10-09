<!-- Suspends on useAtomSuspense inside a pending boundary, so the server renders the pending snippet. -->
<script lang="ts">
  import type { AsyncResult, Atom } from "effect/reactivity";

  import { useAtomSuspense } from "../../src/index.ts";

  const { atom }: { atom: Atom.Atom<AsyncResult.AsyncResult<string>> } = $props();

  const later = useAtomSuspense(() => atom);
</script>

<output>{await later.current}</output>
