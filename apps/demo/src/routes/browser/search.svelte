<script module lang="ts">
  import { Atom } from "effect/reactivity";

  // Reads and writes ?q= in the URL.
  const queryAtom = Atom.searchParam("q");

  // Follows queryAtom once it has stopped changing for 400 milliseconds.
  const debouncedAtom = Atom.debounce(queryAtom, "400 millis");
</script>

<script lang="ts">
  import { useAtom, useAtomValue } from "effect-atom-svelte";

  const query = useAtom(queryAtom);
  const debounced = useAtomValue(debouncedAtom);
</script>

<input bind:value={query.current} data-testid="search" placeholder="Search" />
<p>Now: <output>{query.current}</output></p>
<p>Debounced: <output data-testid="debounced">{debounced.current}</output></p>
