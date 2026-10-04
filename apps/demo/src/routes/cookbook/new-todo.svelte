<script module lang="ts">
  import { Todo } from "@demo/domain";
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
</script>

<script lang="ts">
  import { Cause, Exit, Option } from "effect";
  import { useAtomSet, useAtomValue } from "effect-atom-svelte";

  const todos = useAtomValue(optimisticTodosAtom);
  const creating = useAtomValue(createAtom);
  const create = useAtomSet(createAtom, { mode: "promiseExit" });

  let title = $state("");
  let error = $state("");

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    const exit = await create({ payload: { title } });
    if (Exit.isSuccess(exit)) {
      title = "";
      error = "";
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

<form onsubmit={submit}>
  <input bind:value={title} data-testid="new-todo" placeholder="New todo" />
  <button data-testid="new-todo-add" disabled={creating.current.waiting}>Add</button>
</form>
{#if error}<p data-testid="new-todo-error">{error}</p>{/if}
{#if todos.current._tag === "Success"}
  <ul data-testid="new-todo-list">
    {#each todos.current.value as todo, index (index)}
      <li>{todo.title}{todo.id === 0 ? " (saving…)" : ""}</li>
    {/each}
  </ul>
{:else}
  <p>Loading…</p>
{/if}
