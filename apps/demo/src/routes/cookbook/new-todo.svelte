<script module lang="ts">
  import { isAddedTodo, Todo } from "@demo/domain";
  import { AsyncResult, Atom } from "effect/reactivity";

  import { TodosRpc } from "#lib/clients.ts";

  import { todosAtom } from "./todos.ts";

  // Shows the list with the new todo in it while createTodo runs. Once it succeeds,
  // the list is fetched again; if it fails, the new todo goes away.
  const optimisticTodosAtom = Atom.optimistic(todosAtom);
  const createAtom = optimisticTodosAtom.pipe(
    Atom.optimisticFn({
      fn: TodosRpc.mutation("createTodo"),
      reducer: (current, { payload }) =>
        current.pipe(
          AsyncResult.map((todos) => [
            ...todos,
            new Todo({ done: false, id: 0, title: payload.title }),
          ])
        ),
    })
  );

  // Removes a todo you added. The two the server starts with stay.
  const removeAtom = TodosRpc.mutation("removeTodo");
</script>

<script lang="ts">
  import { Cause, Exit, Option } from "effect";
  import { useAtomSet, useAtomValue } from "effect-atom-svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  const todos = useAtomValue(optimisticTodosAtom);
  const creating = useAtomValue(createAtom);
  const create = useAtomSet(createAtom, { mode: "promiseExit" });
  const remove = useAtomSet(removeAtom);

  let title = $state("");
  let error = $state("");

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    error = "";
    const exit = await create({ payload: { title } });
    if (Exit.isSuccess(exit)) {
      title = "";
      return;
    }
    // The procedure's own errors arrive typed, next to RpcClientError.
    const failure = Cause.findErrorOption(exit.cause);
    error =
      Option.isSome(failure) && failure.value._tag === "TitleTooLong"
        ? `Keep it to ${failure.value.maxLength} characters.`
        : "Could not save the todo.";
  };
</script>

<form class="flex flex-wrap items-center gap-2" onsubmit={submit}>
  <input bind:value={title} data-testid="new-todo" placeholder="New todo" required />
  <button data-testid="new-todo-add" disabled={creating.current.waiting}>
    {creating.current.waiting ? "Adding…" : "Add"}
  </button>
  <StateBadge data-testid="new-todo-state" result={creating.current} />
</form>
{#if error}
  <p>
    <ResultChip kind="message" label="createAtom" tone="failure">
      <span data-testid="new-todo-error">{error}</span>
    </ResultChip>
  </p>
{/if}
{#if todos.current._tag === "Success"}
  <ul class="[overflow-wrap:anywhere]" data-testid="new-todo-list">
    {#each todos.current.value as todo, index (index)}
      {@const saving = todo.id === 0}
      <li aria-busy={saving}>
        {todo.title}{saving ? " (saving…)" : ""}
        {#if !saving && isAddedTodo(todo)}
          <button
            aria-label="Remove {todo.title}"
            onclick={() =>
              remove({ payload: { id: todo.id }, reactivityKeys: ["todos"] })}
          >
            Remove
          </button>
        {/if}
      </li>
    {/each}
  </ul>
{:else if todos.current._tag === "Failure"}
  <p>Could not load the todos.</p>
{:else}
  <p aria-busy="true">Loading…</p>
{/if}
