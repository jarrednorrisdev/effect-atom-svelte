<script lang="ts">
  import { useAtomSet, useAtomValue } from "effect-atom-svelte";

  import { createAtom, todosAtom } from "./todos.ts";

  const todos = useAtomValue(todosAtom);
  const create = useAtomSet(createAtom);
  let title = $state("Buy milk");

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    // When this call succeeds, every atom tagged "todos" runs again.
    create(title);
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
      <li>{todo.title}</li>
    {/each}
  </ul>
{:else}
  <p>Loading the todos…</p>
{/if}
