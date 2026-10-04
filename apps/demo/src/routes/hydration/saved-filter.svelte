<script module lang="ts">
  import { Effect, Schema } from "effect";
  import { KeyValueStore } from "effect/persistence";
  import { AsyncResult, Atom } from "effect/reactivity";

  import { browser } from "$app/env";

  const FilterSchema = Schema.Literals(["all", "open", "done"]);
  type Filter = typeof FilterSchema.Type;

  // The filter this browser saved. The server has no localStorage, so it reads "all".
  const savedFilterAtom = Atom.kvs({
    defaultValue: (): Filter => "all",
    key: "demo-saved-filter",
    runtime: Atom.runtime(
      browser
        ? KeyValueStore.layerStorage(() => localStorage)
        : KeyValueStore.layerMemory
    ),
    schema: FilterSchema,
  });

  const Todos = Schema.Struct({
    titles: Schema.Array(Schema.String),
    where: Schema.String,
  });
  const todos = [
    { done: true, title: "Write the docs" },
    { done: false, title: "Ship 0.1.0" },
    { done: false, title: "Propose it upstream" },
  ];

  // One serializable atom per filter, recording where it ran.
  const todosFor = Atom.family((filter: Filter) =>
    Atom.make(
      Effect.sync((): typeof Todos.Type => ({
        titles: todos
          .filter(({ done }) => filter === "all" || done === (filter === "done"))
          .map(({ title }) => title),
        where: browser ? "browser" : "server",
      })).pipe(Effect.delay("500 millis"))
    ).pipe(
      Atom.serializable({
        key: `filtered-todos-${filter}`,
        schema: AsyncResult.Schema({ success: Todos }),
      })
    )
  );
</script>

<script lang="ts">
  import { useAtom, useAtomResult } from "effect-atom-svelte";
  import { onMount } from "svelte";
  import Origin from "#lib/docs/kit/origin.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  const saved = useAtom(savedFilterAtom);

  // Same choice as the server until mounted, then the saved filter.
  let mounted = $state(false);
  onMount(() => (mounted = true));

  const list = await useAtomResult(() => todosFor(mounted ? saved.current : "all"));
</script>

<p>
  <label>
    Saved filter
    <select bind:value={saved.current} data-testid="saved-filter">
      <option value="all">All</option>
      <option value="open">Open</option>
      <option value="done">Done</option>
    </select>
  </label>
  <button onclick={() => location.reload()}>Reload the page</button>
</p>
{#if list.current._tag === "Success"}
  <Origin data-testid="filtered-where" where={list.current.value.where} />
  <ul data-testid="filtered-todos">
    {#each list.current.value.titles as title (title)}
      <li>{title}</li>
    {/each}
  </ul>
{:else}
  <StateBadge result={list.current} />
{/if}
