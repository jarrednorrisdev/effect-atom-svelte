<script module lang="ts">
  import { Effect } from "effect";
  import { Atom } from "effect/reactivity";

  const modules = [
    "Array",
    "Cause",
    "Effect",
    "Layer",
    "Option",
    "Schema",
    "Stream",
  ];

  // Reads and writes ?q= in the URL.
  const queryAtom = Atom.searchParam("q");

  // Follows queryAtom once it has stopped changing for 400 milliseconds.
  const debouncedAtom = Atom.debounce(queryAtom, "400 millis");

  // Stands in for a search request. It runs once per debounced query, and a new
  // query interrupts the one still running.
  const resultsAtom = Atom.make((get) => {
    const query = get(debouncedAtom).toLowerCase();
    return Effect.succeed(
      modules.filter((name) => name.toLowerCase().includes(query))
    ).pipe(Effect.delay("300 millis"));
  });
</script>

<script lang="ts">
  import { useAtom, useAtomValue } from "effect-atom-svelte";

  const query = useAtom(queryAtom);
  const debounced = useAtomValue(debouncedAtom);
  const results = useAtomValue(resultsAtom);
</script>

<input
  bind:value={query.current}
  data-testid="search"
  placeholder="Search modules"
/>
<p>Searching for: <output data-testid="debounced">{debounced.current}</output></p>
{#if results.current._tag === "Success"}
  <ul data-testid="search-results" style:opacity={results.current.waiting ? 0.5 : 1}>
    {#each results.current.value as name (name)}
      <li>{name}</li>
    {:else}
      <li>No match</li>
    {/each}
  </ul>
{:else}
  <p>Searching…</p>
{/if}
