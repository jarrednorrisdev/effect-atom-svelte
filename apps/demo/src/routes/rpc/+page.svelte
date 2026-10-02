<script module lang="ts">
  import { TITLE_MAX_LENGTH } from "@demo/domain";
  import { Atom } from "effect/reactivity";

  import { TodosRpc } from "#lib/clients.ts";

  const todosAtom = TodosRpc.query("listTodos", undefined, {
    reactivityKeys: ["todos"],
    serializationKey: "rpc-todos",
  });
  const createAtom = TodosRpc.mutation("createTodo");
  const toggleAtom = TodosRpc.mutation("toggleTodo");
  const draftAtom = Atom.make("");
  const selectedAtom = Atom.make(1);
</script>

<script lang="ts">
  import { Cause, Exit } from "effect";
  import {
    useAtom,
    useAtomResult,
    useAtomSet,
    useAtomSuspense,
    useAtomValue,
  } from "effect-atom-svelte";

  const draft = useAtom(draftAtom);
  const selected = useAtom(selectedAtom);
  const creating = useAtomValue(createAtom);
  const create = useAtomSet(createAtom, { mode: "promiseExit" });
  const toggle = useAtomSet(toggleAtom, { mode: "promiseExit" });
  // includeFailure keeps typed errors: in SvelteKit a boundary's failed snippet only receives the
  // sanitised App.Error, not the TodoNotFound itself.
  const todo = useAtomSuspense(() => TodosRpc.query("getTodo", { id: selected.current }), {
    includeFailure: true,
  });
  let error = $state("");

  // Every hook above runs before this await: Svelte does not restore component context after it.
  const todos = await useAtomResult(todosAtom);

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    const exit = await create({ payload: { title: draft.current }, reactivityKeys: ["todos"] });
    if (Exit.isSuccess(exit)) {
      draft.current = "";
      error = "";
    } else {
      error = Cause.pretty(exit.cause).split("\n")[0] ?? "";
    }
  };
</script>

<h1>RPC</h1>

<section>
  <h2>Query, rendered on the server</h2>
  <p>
    <code>await useAtomResult(todosAtom)</code> makes SSR wait; the result is handed to the browser
    through <code>hydratable</code>, so hydration does not wait on the network.
  </p>
  {#if todos.current._tag === "Success"}
    <ul data-testid="rpc-todos" style:opacity={todos.current.waiting ? 0.5 : 1}>
      {#each todos.current.value as item (item.id)}
        <li>
          <label>
            <input
              checked={item.done}
              onchange={() => toggle({ payload: { id: item.id }, reactivityKeys: ["todos"] })}
              type="checkbox"
            />
            {item.title}
          </label>
        </li>
      {/each}
    </ul>
  {:else if todos.current._tag === "Failure"}
    <p>Failed: {Cause.pretty(todos.current.cause)}</p>
  {/if}
</section>

<section>
  <h2>Mutation with reactivity keys and a typed error</h2>
  <p>
    Creating a todo invalidates the <code>todos</code> key, which refetches the list. Titles over
    {TITLE_MAX_LENGTH} characters fail with <code>TitleTooLong</code>.
  </p>
  <form onsubmit={submit}>
    <input bind:value={draft.current} data-testid="rpc-draft" placeholder="New todo" />
    <button data-testid="rpc-add" disabled={creating.current.waiting}>Add</button>
  </form>
  {#if error}<p data-testid="rpc-error">{error}</p>{/if}
</section>

<section>
  <h2>Query family</h2>
  <p>
    A getter makes the hook follow <code>getTodo</code> for the selected id. Id 99 fails with
    <code>TodoNotFound</code>, read from the Failure because <code>includeFailure</code> is set.
  </p>
  <select bind:value={selected.current} data-testid="rpc-select">
    <option value={1}>1</option>
    <option value={2}>2</option>
    <option value={99}>99</option>
  </select>
  <svelte:boundary>
    {@const result = await todo.current}
    <p data-testid="rpc-selected">
      {result._tag === "Success" ? result.value.title : Cause.pretty(result.cause).split("\n")[0]}
    </p>
    {#snippet pending()}<p>Loading…</p>{/snippet}
  </svelte:boundary>
</section>
