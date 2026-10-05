<script module lang="ts">
  import { TodosHttp } from "#lib/clients.ts";

  type Filter = "all" | "true" | "false";

  // GET /api/todos?done=…, one query per filter, each with its own serialization
  // key.
  const todosFor = (filter: Filter) =>
    TodosHttp.query("todos", "list", {
      query: filter === "all" ? {} : { done: filter },
      reactivityKeys: ["todos"],
      serializationKey: `http-todos-${filter}`,
    });

  // POST /api/todos
  const createAtom = TodosHttp.mutation("todos", "create");
  // DELETE /api/todos/:id
  const removeAtom = TodosHttp.mutation("todos", "remove");
</script>

<script lang="ts">
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import { isAddedTodo, type TitleTooLong } from "@demo/domain";
  import { Cause, Exit, Match, Option } from "effect";
  import { useAtomSet, useAtomSuspense, useAtomValue } from "effect-atom-svelte";
  import Part from "#lib/docs/kit/part.svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  let filter = $state<Filter>("all");
  let draft = $state("");
  let error = $state("");

  const todos = useAtomSuspense(() => todosFor(filter));
  const creating = useAtomValue(createAtom);
  const create = useAtomSet(createAtom, { mode: "promiseExit" });
  const remove = useAtomSet(removeAtom);

  // A title that is too long fails with the endpoint's typed 422, TitleTooLong.
  const describe = (cause: Cause.Cause<TitleTooLong>) => {
    const failure = Cause.findErrorOption(cause);
    if (Option.isNone(failure)) {
      return "Something went wrong.";
    }
    return Match.valueTags(failure.value, {
      TitleTooLong: (e) => `TitleTooLong: the limit is ${e.maxLength} characters`,
    });
  };

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
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
  <Part code label="query todos.list">
    <select bind:value={filter} data-testid="http-filter">
      <option value="all">All</option>
      <option value="false">Open</option>
      <option value="true">Done</option>
    </select>
    <code>GET /api/todos{filter === "all" ? "" : `?done=${filter}`}</code>

    <!-- No pending snippet, so server rendering waits for the list. -->
    <ul class="mt-2 grid gap-1" data-testid="http-todos">
      {#each await todos.current as todo (todo.id)}
        <li>
          {todo.done ? "✔" : "○"} {todo.title}
          {#if isAddedTodo(todo)}
            <button
              aria-label="Remove {todo.title}"
              data-cue="reset"
              onclick={() =>
                remove({ params: { id: todo.id }, reactivityKeys: ["todos"] })}
            >
              <Trash2Icon aria-hidden="true" />
            </button>
          {/if}
        </li>
      {/each}
    </ul>
  </Part>

  <Part code label="mutation todos.create">
    <form class="flex" onsubmit={submit}>
      <input
        bind:value={draft}
        class="min-w-0 flex-1"
        data-testid="http-draft"
        placeholder="New todo"
      />
      <button data-testid="http-add" disabled={creating.current.waiting}>Add</button>
    </form>
    <code>POST /api/todos</code>
    <p><StateBadge data-testid="http-add-state" result={creating.current} /></p>
    {#if error}
      <ResultChip kind="message" tone="failure">
        <span data-testid="http-error">{error}</span>
      </ResultChip>
    {/if}
  </Part>
</div>
