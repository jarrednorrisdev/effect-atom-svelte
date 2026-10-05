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

  // What the box holds, on every key.
  const queryAtom = Atom.make("");

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
  import FlashValue from "#lib/docs/kit/flash-value.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  import SearchTimeline from "./search-timeline.svelte";

  const query = useAtom(queryAtom);
  const debounced = useAtomValue(debouncedAtom);
  const results = useAtomValue(resultsAtom);
</script>

<p class="flex flex-wrap items-center gap-2">
  <input
    aria-label="Search modules"
    bind:value={query.current}
    data-testid="search"
    placeholder="Search modules"
  />
  <StateBadge data-testid="search-state" result={results.current} />
</p>
<p class="flex flex-wrap gap-x-6 gap-y-2">
  <span>queryAtom: <FlashValue value={query.current} /></span>
  <span>
    debouncedAtom: <FlashValue data-testid="debounced" value={debounced.current} />
  </span>
</p>
{#if results.current._tag === "Success"}
  <ul aria-busy={results.current.waiting} data-testid="search-results">
    {#each results.current.value as name (name)}
      <li>{name}</li>
    {:else}
      <li>No match</li>
    {/each}
  </ul>
{:else}
  <p aria-busy="true">Searching…</p>
{/if}
<SearchTimeline
  debounced={debounced.current}
  query={query.current}
  result={results.current}
/>
