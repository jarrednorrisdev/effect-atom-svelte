<script module lang="ts">
  import { Effect, Option, Stream } from "effect";
  import { Atom } from "effect/reactivity";

  const fruit = ["apple", "banana", "cherry", "damson", "elderberry", "fig", "grape"];

  // Pages of up to three, each taking a moment to arrive, as from a paginated API.
  const fruitStream = Stream.paginate(0, (start) =>
    Effect.succeed([
      fruit.slice(start, start + 3),
      start + 3 < fruit.length ? Option.some(start + 3) : Option.none(),
    ] as const).pipe(Effect.delay("400 millis"))
  );

  // Reads the first page, then the next one each time it is written to.
  const fruitAtom = Atom.pull(fruitStream);
  // The same, but items holds only the latest page.
  const latestPageAtom = Atom.pull(fruitStream, { disableAccumulation: true });
</script>

<script lang="ts">
  import { AsyncResult } from "effect/reactivity";
  import { useAtomSet, useAtomValue } from "effect-atom-svelte";
  import CauseView from "#lib/docs/kit/cause-view.svelte";
  import Chunks from "#lib/docs/kit/chunks.svelte";
  import FlashValue from "#lib/docs/kit/flash-value.svelte";
  import ResultHistory from "#lib/docs/kit/result-history.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  let accumulate = $state(true);
  const atom = () => (accumulate ? fruitAtom : latestPageAtom);

  const page = useAtomValue(atom);
  const loadMore = useAtomSet(atom);

  // The latest items, kept through a failure. With disableAccumulation, the pull
  // that finds the end fails with NoSuchElementError instead of setting done.
  const latest = $derived(AsyncResult.getOrElse(page.current, () => undefined));
  const ended = $derived(page.current._tag === "Failure" || latest?.done === true);
  // How the pull that found the end ended, for the chunks.
  const ending = $derived.by(() => {
    if (page.current._tag === "Failure") {
      return "NoSuchElementError";
    }
    return latest?.done ? "done" : undefined;
  });

  // For the history under the example.
  const describe = (value: unknown) => {
    const { done, items } = value as { done: boolean; items: string[] };
    return `${items.length} ${items.length === 1 ? "item" : "items"}, done: ${done}`;
  };
</script>

<p>
  <button aria-pressed={!accumulate} onclick={() => (accumulate = !accumulate)}>
    disableAccumulation: true
  </button>
</p>
{#if latest}
  <!-- Groups the items by the pull that brought them. -->
  {#key accumulate}
    <Chunks data-testid="fruit" end={ending} items={latest.items} />
  {/key}
  <p class="flex flex-wrap items-center gap-3">
    <button disabled={ended || page.current.waiting} onclick={() => loadMore()}>
      {#if page.current.waiting}
        Loading…
      {:else if ended}
        No more fruit
      {:else}
        Load more
      {/if}
    </button>
    <span>
      done:
      <FlashValue data-testid="fruit-done" value={latest.done} />
    </span>
    <StateBadge data-testid="fruit-state" result={page.current} />
  </p>
  {#if page.current._tag === "Failure"}
    <CauseView cause={page.current.cause} data-testid="fruit-cause" />
  {/if}
{:else}
  <p>Loading…</p>
{/if}
<!-- Each pull adds a chunk: one page, or nothing once the stream ends. -->
<ResultHistory format={describe} label="Pulls" result={page.current} />
