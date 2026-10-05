<script module lang="ts">
  import { TodosRpc } from "#lib/clients.ts";

  // The serialization key lets the browser reuse the server's result when it hydrates.
  const todosAtom = TodosRpc.query("listTodos", undefined, {
    reactivityKeys: ["todos"],
    serializationKey: "rpc-todos",
  });
  const createAtom = TodosRpc.mutation("createTodo");
  const toggleAtom = TodosRpc.mutation("toggleTodo");
  const removeAtom = TodosRpc.mutation("removeTodo");
</script>

<script lang="ts">
  import { SvelteSet } from "svelte/reactivity";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import { isAddedTodo, type TitleTooLong } from "@demo/domain";
  import { Cause, Exit, Match, Option } from "effect";
  import type { RpcClientError } from "effect/rpc";
  import { useAtomResult, useAtomSet, useAtomValue } from "effect-atom-svelte";
  import Part from "#lib/docs/kit/part.svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  // Server rendering waits for the list.
  const todos = await useAtomResult(todosAtom);

  const creating = useAtomValue(createAtom);
  const create = useAtomSet(createAtom, { mode: "promiseExit" });
  const toggle = useAtomSet(toggleAtom);
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

  let draft = $state("");
  let error = $state("");

  // A title that is too long fails with the RPC's typed error, TitleTooLong.
  const describe = (
    cause: Cause.Cause<TitleTooLong | RpcClientError.RpcClientError>
  ) => {
    const failure = Cause.findErrorOption(cause);
    if (Option.isNone(failure)) {
      return "Something went wrong.";
    }
    return Match.valueTags(failure.value, {
      RpcClientError: (e) => `Could not reach the server: ${e.message}`,
      TitleTooLong: (e) => `TitleTooLong: the limit is ${e.maxLength} characters`,
    });
  };

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    // Invalidating "todos" makes todosAtom fetch the list again.
    const exit = await create({ payload: { title: draft }, reactivityKeys: ["todos"] });
    if (Exit.isSuccess(exit)) {
      draft = "";
      error = "";
    } else {
      error = describe(exit.cause);
    }
  };
</script>

<div class="grid gap-3 sm:grid-cols-2">
  <Part code label="query listTodos">
    <StateBadge data-testid="rpc-todos-state" result={todos.current} sound={false} />
    {#if todos.current._tag === "Success"}
      <ul
        aria-busy={todos.current.waiting}
        class="mt-2 grid gap-1"
        data-testid="rpc-todos"
      >
        {#each todos.current.value as todo (todo.id)}
          <li aria-busy={leaving.has(todo.id)}>
            <label>
              <input
                checked={todo.done}
                onchange={() =>
                  toggle({ payload: { id: todo.id }, reactivityKeys: ["todos"] })}
                type="checkbox"
              />
              {todo.title}
            </label>
            <!-- Only the todos you added; the server's two stay. -->
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
    {:else if todos.current._tag === "Failure"}
      <p>Could not load the todos: {Cause.pretty(todos.current.cause)}</p>
    {/if}
  </Part>

  <Part code label="mutation createTodo">
    <form class="flex" onsubmit={submit}>
      <input
        bind:value={draft}
        class="min-w-0 flex-1"
        data-testid="rpc-draft"
        placeholder="New todo"
      />
      <button data-testid="rpc-add" disabled={creating.current.waiting}>Add</button>
    </form>
    <p><StateBadge data-testid="rpc-add-state" result={creating.current} /></p>
    {#if error}
      <ResultChip kind="message" tone="failure">
        <span data-testid="rpc-error">{error}</span>
      </ResultChip>
    {/if}
  </Part>
</div>
