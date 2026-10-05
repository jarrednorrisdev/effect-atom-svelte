<!--
  @component
  A pull atom's items, grouped by the pull that brought them: each time `items` grows, the new
  ones are a chunk. When `items` is replaced instead (disableAccumulation), the new items are the
  only chunk. Once `end` is set, the pull that found the end shows as an empty one.

  ```svelte
  <Chunks end={done ? "done" : undefined} items={page.value.items} />
  ```

  Other attributes go on the list.
-->
<script lang="ts">
  import { untrack } from "svelte";
  import type { HTMLOlAttributes } from "svelte/elements";

  interface Props extends HTMLOlAttributes {
    /** How the pull that found the end ended, once one has: "done", or an error. */
    readonly end?: string | undefined;
    readonly items: readonly unknown[];
  }

  interface Chunk {
    readonly end?: string | undefined;
    readonly items: readonly unknown[];
    readonly pull: number;
  }

  const { end, items, ...rest }: Props = $props();

  let chunks = $state<Chunk[]>([]);
  let pulls = 0;
  let seen: readonly unknown[] = [];
  let wasEnded = false;

  const track = (now: readonly unknown[], ending: string | undefined) => {
    const grew = now.length > seen.length && seen.every((item, i) => now[i] === item);
    if (grew) {
      pulls += 1;
      chunks.push({ items: now.slice(seen.length), pull: pulls });
    } else if (now !== seen) {
      pulls += 1;
      chunks = [{ items: [...now], pull: pulls }];
    } else if (ending !== undefined && !wasEnded) {
      // The pull that finds the end brings no items.
      pulls += 1;
      chunks.push({ end: ending, items: [], pull: pulls });
    }
    seen = now;
    wasEnded = ending !== undefined;
  };

  $effect(() => {
    const now = items;
    const ending = end;
    untrack(() => track(now, ending));
  });
</script>

<ol class="chunks not-prose" {...rest}>
  {#each chunks as chunk (chunk.pull)}
    <li aria-label="Pull {chunk.pull}">
      <span class="pull">pull {chunk.pull}</span>
      {#each chunk.items as item, index (index)}
        <output>{String(item)}</output>
      {:else}
        <span class="nothing">nothing: {chunk.end}</span>
      {/each}
    </li>
  {/each}
</ol>

<style>
  .chunks {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    list-style: none;
    margin: 0 0 1rem;
    padding: 0;
  }
  li {
    align-items: center;
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius-md);
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin: 0;
    padding: 0.375rem 0.5rem;
  }
  .nothing {
    color: var(--muted-foreground);
    font-family: var(--font-mono);
    font-size: 0.8rem;
  }
  .pull {
    color: var(--muted-foreground);
    font-family: var(--font-mono);
    font-size: 0.7rem;
    text-transform: uppercase;
  }
</style>
