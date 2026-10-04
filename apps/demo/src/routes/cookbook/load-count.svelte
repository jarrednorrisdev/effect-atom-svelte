<script lang="ts">
  import { page } from "$app/state";
  import { useAtomValue } from "effect-atom-svelte";
  import FlashValue from "#lib/docs/kit/flash-value.svelte";
  import Part from "#lib/docs/kit/part.svelte";

  import { todosAtom } from "./todos.ts";

  // What load returned when the page was rendered, and the same list, live.
  const loaded = $derived(page.data.todoCount as number | undefined);
  const todos = useAtomValue(todosAtom);
</script>

<div class="flex flex-wrap gap-3">
  <Part code label="load">
    <output data-testid="load-count">{loaded ?? "?"}</output> todos
  </Part>
  <Part code label="todosAtom" tone="success">
    {#if todos.current._tag === "Success"}
      <FlashValue
        data-testid="load-live-count"
        value={todos.current.value.length}
      /> todos
    {:else}
      <span aria-busy="true">Loading…</span>
    {/if}
  </Part>
</div>
