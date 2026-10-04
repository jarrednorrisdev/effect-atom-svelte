<script module lang="ts">
  import { Effect, Option, Stream } from "effect";
  import { Atom } from "effect/reactivity";

  const fruit = ["apple", "banana", "cherry", "damson", "elderberry", "fig", "grape"];

  // Pages of three, each taking a moment to arrive, as from a paginated API.
  const fruitStream = Stream.paginate(0, (start) =>
    Effect.succeed([
      fruit.slice(start, start + 3),
      start + 3 < fruit.length ? Option.some(start + 3) : Option.none(),
    ] as const).pipe(Effect.delay("400 millis"))
  );

  // Reads the first page, then the next one each time it is written to.
  const fruitAtom = Atom.pull(fruitStream);
</script>

<script lang="ts">
  import { useAtomSet, useAtomValue } from "effect-atom-svelte";
  import FlashValue from "#lib/docs/kit/flash-value.svelte";
  import ResultHistory from "#lib/docs/kit/result-history.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  const page = useAtomValue(fruitAtom);
  const loadMore = useAtomSet(fruitAtom);

  // For the history under the example.
  const describe = (value: unknown) => {
    const { done, items } = value as { done: boolean; items: string[] };
    return `${items.length} items, done: ${done}`;
  };
</script>

{#if page.current._tag === "Success"}
  <ul class="flex list-none flex-wrap gap-1.5 p-0" data-testid="fruit">
    {#each page.current.value.items as item (item)}
      <li class="m-0"><output>{item}</output></li>
    {/each}
  </ul>
  <p class="flex flex-wrap items-center gap-3">
    <button
      disabled={page.current.value.done || page.current.waiting}
      onclick={() => loadMore()}
    >
      {page.current.value.done ? "No more fruit" : "Load more"}
    </button>
    <span>
      done:
      <FlashValue data-testid="fruit-done" value={page.current.value.done} />
    </span>
    <StateBadge data-testid="fruit-state" result={page.current} />
  </p>
{:else}
  <p>Loading…</p>
{/if}
<!-- Each pull adds a chunk: one page of three, or nothing once the stream ends. -->
<ResultHistory format={describe} label="Pulls" result={page.current} />

