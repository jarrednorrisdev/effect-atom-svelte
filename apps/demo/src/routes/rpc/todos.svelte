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
  import { Exit } from "effect";
  import { useAtomResult, useAtomSet, useAtomValue } from "effect-atom-svelte";
  import CauseView from "#lib/docs/kit/cause-view.svelte";
  import Part from "#lib/docs/kit/part.svelte";
  import { RequestCount } from "#lib/docs/kit/requests.svelte.ts";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  // Declared before the await: a binding to state declared after it is only set up once the
  // await settles, after hydration, and would clear text typed before then.
  let draft = $state("");

  // For the list's counter: each time the query fetches from the browser.
  const requests = new RequestCount(() => todosAtom);

  const creating = useAtomValue(createAtom);
  const create = useAtomSet(createAtom, { mode: "promiseExit" });
  const toggle = useAtomSet(toggleAtom);

  // Server rendering waits for the list. The other hooks come first: a hook called after the
  // await misses the server's results (see Hydration).
  const todos = await useAtomResult(todosAtom);

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
          <li>
            <label>
              <!-- The box ticks when the refetched list says so, not on click, so a failed toggle
                   leaves it as it was. -->
              <input
                checked={todo.done}
                onclick={(event) => {
                  event.preventDefault();
                  toggle({ payload: { id: todo.id }, reactivityKeys: ["todos"] });
                }}
                type="checkbox"
              />
              {todo.title}
            </label>
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
