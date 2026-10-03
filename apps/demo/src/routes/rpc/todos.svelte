<script module lang="ts">
  import { TodosRpc } from "#lib/clients.ts";

  // The serialization key lets the browser reuse the server's result when it hydrates.
  const todosAtom = TodosRpc.query("listTodos", undefined, {
    reactivityKeys: ["todos"],
    serializationKey: "rpc-todos",
  });
  const createAtom = TodosRpc.mutation("createTodo");
  const toggleAtom = TodosRpc.mutation("toggleTodo");
</script>

<script lang="ts">
  import { Cause, Exit } from "effect";
  import { useAtomResult, useAtomSet, useAtomValue } from "effect-atom-svelte";

  // Server rendering waits for the list.
  const todos = await useAtomResult(todosAtom);

  const creating = useAtomValue(createAtom);
  const create = useAtomSet(createAtom, { mode: "promiseExit" });
  const toggle = useAtomSet(toggleAtom);

  let draft = $state("");
  let error = $state("");

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    // Invalidating "todos" makes todosAtom fetch the list again.
    const exit = await create({ payload: { title: draft }, reactivityKeys: ["todos"] });
    if (Exit.isSuccess(exit)) {
      draft = "";
      error = "";
    } else {
      // A title that is too long fails with the RPC's typed error, TitleTooLong.
      error = Cause.pretty(exit.cause).split("\n")[0] ?? "";
    }
  };
</script>

{#if todos.current._tag === "Success"}
  <ul data-testid="rpc-todos" style:opacity={todos.current.waiting ? 0.5 : 1}>
    {#each todos.current.value as todo (todo.id)}
      <li>
        <label>
          <input
            checked={todo.done}
            onchange={() =>
              toggle({ payload: { id: todo.id }, reactivityKeys: ["todos"] })}
            type="checkbox"
          />
          {todo.title}
        </label>
      </li>
    {/each}
  </ul>
{:else if todos.current._tag === "Failure"}
  <p>Could not load the todos: {Cause.pretty(todos.current.cause)}</p>
{/if}

<form onsubmit={submit}>
  <input bind:value={draft} data-testid="rpc-draft" placeholder="New todo" />
  <button data-testid="rpc-add" disabled={creating.current.waiting}>Add</button>
</form>
{#if error}<p data-testid="rpc-error">{error}</p>{/if}
