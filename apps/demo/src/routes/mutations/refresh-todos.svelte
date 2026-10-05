<script lang="ts">
  import { Exit } from "effect";
  import { SvelteSet } from "svelte/reactivity";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import { isAddedTodo } from "@demo/domain";
  import { useAtomSet, useAtomValue } from "effect-atom-svelte";

  import { createAtom, removeAtom, todosAtom } from "./todos.ts";

  const todos = useAtomValue(todosAtom);
  const create = useAtomSet(createAtom);
  // One remove at a time: a second call would interrupt the first.
  const removing = useAtomValue(removeAtom);
  const remove = useAtomSet(removeAtom, { mode: "promiseExit" });
  // The todos being removed: their rows pulse until the list comes back without them.
  const leaving = new SvelteSet<number>();
  const removeTodo = async (id: number) => {
    leaving.add(id);
    const exit = await remove({ payload: { id }, reactivityKeys: ["todos"] });
    if (Exit.isFailure(exit)) {
      leaving.delete(id);
    }
  };
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
      <li aria-busy={leaving.has(todo.id)}>
        {todo.title}
        {#if isAddedTodo(todo)}
          <button
            aria-label="Remove {todo.title}"
            data-cue="reset"
            disabled={removing.current.waiting}
            onclick={() => removeTodo(todo.id)}
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
