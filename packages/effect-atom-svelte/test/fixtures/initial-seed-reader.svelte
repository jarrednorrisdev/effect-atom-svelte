<!-- Awaits initialSeedAtom, or the atom it is given, and refreshes it on click. -->
<script lang="ts">
  import type { AsyncResult, Atom } from "effect/reactivity";

  import { useAtomRefresh, useAtomResult } from "../../src/index.ts";
  import { initialSeedAtom } from "./initial-seed.ts";

  const {
    atom = initialSeedAtom,
  }: { atom?: Atom.Atom<AsyncResult.AsyncResult<string>> } = $props();
  // svelte-ignore state_referenced_locally
  const refresh = useAtomRefresh(atom);
  // svelte-ignore state_referenced_locally
  const result = await useAtomResult(atom);
</script>

<button onclick={refresh}>Refresh</button>
<output>{result.current._tag === "Success" ? result.current.value : result.current._tag}</output>
