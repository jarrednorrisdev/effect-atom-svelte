<script lang="ts">
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import { isAddedTodo } from "@demo/domain";
  import { useAtomSet, useAtomValue } from "effect-atom-svelte";

  import { createAtom, removeAtom, todosAtom } from "./todos.ts";

  const todos = useAtomValue(todosAtom);
  const create = useAtomSet(createAtom);
  const remove = useAtomSet(removeAtom);
  let title = $state("Buy milk");

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    // When this call succeeds, every atom tagged "todos" runs again.
    create({ payload: { title }, reactivityKeys: ["todos"] });
  };
</script>

<form class="flex flex-wrap items-center gap-2" onsubmit={submit}>
  <input
    aria-label="Todo to add"
    bind:value={title}
    data-testid="refresh-draft"
  />
  <button data-testid="refresh-submit">Add</button>
  <button onclick={() => (title = "x".repeat(70))} type="button">
    Paste a long title
  </button>
</form>
{#if todos.current._tag === "Success"}
  <ul aria-busy={todos.current.waiting} data-testid="refresh-todos">
    {#each todos.current.value as todo (todo.id)}
      <li>
        {todo.title}
        {#if isAddedTodo(todo)}
          <button
            aria-label="Remove {todo.title}"
            data-cue="reset"
            onclick={() =>
              remove({ payload: { id: todo.id }, reactivityKeys: ["todos"] })}
          >
            <Trash2Icon aria-hidden="true" />
          </button>
        {/if}
      </li>
    {/each}
  </ul>
{:else}
  <p>Loading the todos…</p>
{/if}
