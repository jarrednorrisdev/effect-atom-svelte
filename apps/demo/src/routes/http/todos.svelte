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
  import { isAddedTodo } from "@demo/domain";
  import { Exit } from "effect";
  import { useAtomSet, useAtomSuspense, useAtomValue } from "effect-atom-svelte";
  import { SvelteSet } from "svelte/reactivity";
  import CauseView from "#lib/docs/kit/cause-view.svelte";
  import Part from "#lib/docs/kit/part.svelte";
  import { RequestCount } from "#lib/docs/kit/requests.svelte.ts";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  const filters = [
    { label: "All", value: "all" },
    { label: "Open", value: "false" },
    { label: "Done", value: "true" },
  ] as const;
  let filter = $state<Filter>("all");
  let draft = $state("");

  const todos = useAtomSuspense(() => todosFor(filter));
  // For the list's counter: each request a list query makes from the browser.
  const requests = new RequestCount(() => todosFor(filter));
  const creating = useAtomValue(createAtom);
  const create = useAtomSet(createAtom, { mode: "promiseExit" });
  // One remove at a time: a second call would interrupt the first.
  const removing = useAtomValue(removeAtom);
  const remove = useAtomSet(removeAtom, { mode: "promiseExit" });
  // The todos being removed: their rows pulse until the list comes back without them.
  const leaving = new SvelteSet<number>();
  const removeTodo = async (id: number) => {
    leaving.add(id);
    const exit = await remove({ params: { id }, reactivityKeys: ["todos"] });
    if (Exit.isFailure(exit)) {
      leaving.delete(id);
    }
  };

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    const exit = await create({ payload: { title: draft }, reactivityKeys: ["todos"] });
    if (Exit.isSuccess(exit)) {
      draft = "";
    }
  };
</script>

<div class="grid gap-3 sm:grid-cols-2">
  <Part code count={requests.current} countLabel="requests" label="query todos.list">
    <div aria-label="Filter" class="flex flex-wrap gap-2" role="group">
      {#each filters as option (option.value)}
        <button
          aria-pressed={filter === option.value}
          onclick={() => (filter = option.value)}
        >
          {option.label}
        </button>
      {/each}
    </div>
    <code>GET /api/todos{filter === "all" ? "" : `?done=${filter}`}</code>

    <!-- No pending snippet, so server rendering waits for the list. -->
    <ul class="mt-2 grid gap-1" data-testid="http-todos">
      {#each await todos.current as todo (todo.id)}
        <li aria-busy={leaving.has(todo.id)}>
          {todo.done ? "✔" : "○"} {todo.title}
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
    <p class="flex flex-wrap items-center gap-2">
      <button onclick={() => (draft = "x".repeat(70))} type="button">
        Paste a long title
      </button>
      <StateBadge data-testid="http-add-state" result={creating.current} />
    </p>
    <!-- The endpoint declares TitleTooLong with status 422, so it arrives typed. -->
    {#if creating.current._tag === "Failure"}
      <CauseView cause={creating.current.cause} data-testid="http-error" />
    {/if}
  </Part>
</div>
