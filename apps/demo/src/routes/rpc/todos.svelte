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
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import { isAddedTodo } from "@demo/domain";
  import { Exit } from "effect";
  import { useAtomResult, useAtomSet, useAtomValue } from "effect-atom-svelte";
  import { SvelteSet } from "svelte/reactivity";
  import CauseView from "#lib/docs/kit/cause-view.svelte";
  import Part from "#lib/docs/kit/part.svelte";
  import { RequestCount } from "#lib/docs/kit/requests.svelte.ts";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  // Server rendering waits for the list.
  const todos = await useAtomResult(todosAtom);
  // For the list's counter: each time the query fetches from the browser.
  const requests = new RequestCount(() => todosAtom);

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

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    // Invalidating "todos" makes todosAtom fetch the list again.
    const exit = await create({ payload: { title: draft }, reactivityKeys: ["todos"] });
    if (Exit.isSuccess(exit)) {
      draft = "";
    }
  };
</script>

<div class="grid gap-3 sm:grid-cols-2">
  <Part code count={requests.current} countLabel="requests" label="query listTodos">
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
      <CauseView cause={todos.current.cause} />
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
    <p class="flex flex-wrap items-center gap-2">
      <button onclick={() => (draft = "x".repeat(70))} type="button">
        Paste a long title
      </button>
      <StateBadge data-testid="rpc-add-state" result={creating.current} />
    </p>
    <!-- TitleTooLong is the procedure's typed error. -->
    {#if creating.current._tag === "Failure"}
      <CauseView cause={creating.current.cause} data-testid="rpc-error" />
    {/if}
  </Part>
</div>
