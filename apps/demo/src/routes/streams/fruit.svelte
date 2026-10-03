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

  const page = useAtomValue(fruitAtom);
  const loadMore = useAtomSet(fruitAtom);
</script>

{#if page.current._tag === "Success"}
  <p data-testid="fruit">{page.current.value.items.join(", ")}</p>
  <button
    disabled={page.current.value.done || page.current.waiting}
    onclick={() => loadMore()}
  >
    {page.current.value.done ? "No more fruit" : "Load more"}
  </button>
{:else}
  <p>Loading…</p>
{/if}
