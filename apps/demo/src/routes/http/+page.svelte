<script module lang="ts">
  import { Atom } from "effect/reactivity";

  import { TodosHttp } from "#lib/clients.ts";

  type Filter = "all" | "true" | "false";

  const filterAtom = Atom.make<Filter>("all");
  const lookupAtom = Atom.make(2);
  const draftAtom = Atom.make("");
  const createAtom = TodosHttp.mutation("todos", "create");

  const listFor = (filter: Filter) =>
    TodosHttp.query("todos", "list", {
      query: filter === "all" ? {} : { done: filter },
      reactivityKeys: ["todos"],
      serializationKey: `http-todos-${filter}`,
    });
</script>

<script lang="ts">
  import { Cause, Exit } from "effect";
  import { useAtom, useAtomSet, useAtomSuspense } from "effect-atom-svelte";

  const filter = useAtom(filterAtom);
  const lookup = useAtom(lookupAtom);
  const draft = useAtom(draftAtom);
  const create = useAtomSet(createAtom, { mode: "promiseExit" });
  const todos = useAtomSuspense(() => listFor(filter.current));
  const found = useAtomSuspense(
    () => TodosHttp.query("todos", "get", { params: { id: lookup.current } }),
    { includeFailure: true }
  );
  let error = $state("");

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    const exit = await create({ payload: { title: draft.current }, reactivityKeys: ["todos"] });
    error = Exit.isSuccess(exit) ? "" : (Cause.pretty(exit.cause).split("\n")[0] ?? "");
    if (Exit.isSuccess(exit)) {
      draft.current = "";
    }
  };
</script>

<h1>HTTP API</h1>

<section>
  <h2>Query with query params, rendered on the server</h2>
  <p>
    <code>GET /api/todos?done=…</code> through <code>AtomHttpApi</code>. The list is awaited in
    markup with no pending snippet, so SSR waits for it.
  </p>
  <select bind:value={filter.current} data-testid="http-filter">
    <option value="all">All</option>
    <option value="false">Open</option>
    <option value="true">Done</option>
  </select>
  <ul data-testid="http-todos">
    {#each await todos.current as item (item.id)}
      <li>{item.done ? "✔" : "○"} {item.title}</li>
    {/each}
  </ul>
</section>

<section>
  <h2>Mutation over HTTP</h2>
  <p><code>POST /api/todos</code>; an over-long title fails with a typed 422.</p>
  <form onsubmit={submit}>
    <input bind:value={draft.current} data-testid="http-draft" placeholder="New todo" />
    <button data-testid="http-add">Add</button>
  </form>
  {#if error}<p data-testid="http-error">{error}</p>{/if}
</section>

<section>
  <h2>Path params and a typed 404</h2>
  <p>
    <code>GET /api/todos/:id</code> with <code>includeFailure</code>, so a <code>TodoNotFound</code>
    resolves as a Failure instead of reaching the boundary.
  </p>
  <input bind:value={lookup.current} data-testid="http-id" min="1" type="number" />
  <svelte:boundary>
    {@const result = await found.current}
    <p data-testid="http-found">
      {result._tag === "Success" ? result.value.title : Cause.pretty(result.cause).split("\n")[0]}
    </p>
    {#snippet pending()}<p>Loading…</p>{/snippet}
  </svelte:boundary>
</section>
