<script module lang="ts">
  import { Effect, Option, Stream } from "effect";
  import { Atom } from "effect/reactivity";

  const pageSize = 10;
  const total = 50;

  // Pages of ten entries, each taking a moment to arrive, as from a paginated API.
  const entries = Stream.paginate(1, (first) =>
    Effect.succeed([
      Array.from({ length: pageSize }, (_, index) => `Entry ${first + index}`),
      first + pageSize <= total ? Option.some(first + pageSize) : Option.none(),
    ] as const).pipe(Effect.delay("300 millis"))
  );

  // Reads the first page, then the next one each time it is written to.
  const feedAtom = Atom.pull(entries);
</script>

<script lang="ts">
  import { useAtomSet, useAtomValue } from "effect-atom-svelte";
  import type { Attachment } from "svelte/attachments";

  const feed = useAtomValue(feedAtom);
  const loadMore = useAtomSet(feedAtom);

  // Pulls the next page when the element scrolls into the list's view.
  const pullWhenVisible: Attachment<HTMLElement> = (node) => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !feed.current.waiting) {
          loadMore();
        }
      },
      { root: node.closest("ul") }
    );
    observer.observe(node);
    return () => observer.disconnect();
  };
</script>

<ul class="h-48 overflow-y-auto rounded-md border" data-testid="feed">
  {#if feed.current._tag === "Success"}
    {@const { done, items } = feed.current.value}
    {#each items as entry (entry)}<li>{entry}</li>{/each}
    {#if done}
      <li>That's everything.</li>
    {:else}
      <!-- A new element per page, so a fresh observer checks it after each pull. -->
      {#key items.length}<li {@attach pullWhenVisible}>Loading more…</li>{/key}
    {/if}
  {:else}
    <li>Loading…</li>
  {/if}
</ul>
