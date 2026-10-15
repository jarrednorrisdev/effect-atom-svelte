<script lang="ts">
  import { Option } from "effect";
  import { useAtomResult } from "effect-atom-svelte";
  import { AsyncResult } from "effect/reactivity";

  import { TodosRpc } from "#lib/clients.ts";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";

  let id = $state(1);

  // Typed by the server's RpcGroup: getTodo's success, or a TodoNotFound failure.
  const todo = await useAtomResult(() => TodosRpc.query("getTodo", { id }));
  // A match on the typed error, not on whatever was thrown.
  const error = $derived(AsyncResult.error(todo.current));
  const notFound = $derived(
    Option.isSome(error) && error.value._tag === "TodoNotFound"
  );
</script>

<div aria-label="Todo" class="flex flex-wrap gap-2" role="group">
  {#each [1, 2, 99] as option (option)}
    <button aria-pressed={id === option} onclick={() => (id = option)}>
      Todo {option}
    </button>
  {/each}
</div>

<div class="mt-3" data-testid="lookup">
  {#if todo.current._tag === "Success"}
    <ResultChip busy={todo.current.waiting} kind="message" tone="success">
      {todo.current.value.title}
    </ResultChip>
  {:else if notFound}
    <ResultChip busy={todo.current.waiting} kind="message" tone="failure">
      There is no todo {id}
    </ResultChip>
  {:else if todo.current._tag === "Failure"}
    <ResultChip kind="message" tone="failure">Couldn't load the todo</ResultChip
    >
  {:else}
    <ResultChip kind="message" tone="running">Loading…</ResultChip>
  {/if}
</div>
