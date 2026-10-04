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
</script>

<script lang="ts">
  import type { TitleTooLong } from "@demo/domain";
  import { Cause, Exit, Match, Option } from "effect";
  import { useAtomSet, useAtomSuspense } from "effect-atom-svelte";

  let filter = $state<Filter>("all");
  let draft = $state("");
  let error = $state("");

  const todos = useAtomSuspense(() => todosFor(filter));
  const create = useAtomSet(createAtom, { mode: "promiseExit" });

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

<select bind:value={filter} data-testid="http-filter">
  <option value="all">All</option>
  <option value="false">Open</option>
  <option value="true">Done</option>
</select>

<!-- No pending snippet, so server rendering waits for the list. -->
<ul data-testid="http-todos">
  {#each await todos.current as todo (todo.id)}
    <li>{todo.done ? "✔" : "○"} {todo.title}</li>
  {/each}
</ul>

<form onsubmit={submit}>
  <input bind:value={draft} data-testid="http-draft" placeholder="New todo" />
  <button data-testid="http-add">Add</button>
</form>
{#if error}<p data-testid="http-error">{error}</p>{/if}
