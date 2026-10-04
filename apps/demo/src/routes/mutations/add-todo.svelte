<script module lang="ts">
  import { TodosRpc } from "#lib/clients.ts";

  // The demo server's todos. Tagged "todos": it runs again when a mutation
  // invalidates that key.
  export const todosAtom = TodosRpc.query("listTodos", undefined, {
    reactivityKeys: ["todos"],
  });

  // Each write sends one createTodo request.
  export const createAtom = TodosRpc.mutation("createTodo");
</script>

<script lang="ts">
  import { Cause, Exit, Option } from "effect";
  import { useAtomSet, useAtomValue } from "effect-atom-svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";
  import { enter } from "#lib/docs/kit/motion.ts";

  const todos = useAtomValue(todosAtom);
  const creating = useAtomValue(createAtom);
  const create = useAtomSet(createAtom, { mode: "promiseExit" });

  let title = $state("Water the plants");
  let error = $state("");

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    const exit = await create({ payload: { title }, reactivityKeys: ["todos"] });
    if (Exit.isSuccess(exit)) {
      title = "";
      error = "";
      return;
    }
    // A failure keeps the title, so the reader can fix it.
    const failure = Cause.findErrorOption(exit.cause);
    error =
      Option.isSome(failure) && failure.value._tag === "TitleTooLong"
        ? `TitleTooLong: keep it to ${failure.value.maxLength} characters.`
        : "Could not reach the server.";
  };
</script>

<form class="flex flex-wrap items-center gap-2" onsubmit={submit}>
  <input
    aria-label="New todo"
    bind:value={title}
    data-testid="add-draft"
    placeholder="New todo"
  />
  <button data-testid="add-submit" disabled={creating.current.waiting}>
    {creating.current.waiting ? "Adding…" : "Add"}
  </button>
  <button onclick={() => (title = "x".repeat(70))} type="button">
    Paste a long title
  </button>
  <StateBadge data-testid="add-state" result={creating.current} />
</form>
{#if error}
  <ResultChip kind="message" label="createAtom" tone="failure">
    <span data-testid="add-error">{error}</span>
  </ResultChip>
{/if}
{#if todos.current._tag === "Success"}
  <ul aria-busy={todos.current.waiting} data-testid="add-todos">
    {#each todos.current.value as todo (todo.id)}
      <li {@attach enter()}>{todo.title}</li>
    {/each}
  </ul>
{:else}
  <p>Loading the todos…</p>
{/if}
