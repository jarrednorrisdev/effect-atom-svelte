<script lang="ts">
  import type { TodoNotFound } from "@demo/domain";
  import { Cause, Match, Option } from "effect";
  import { useAtomSuspense } from "effect-atom-svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";

  import { TodosHttp } from "#lib/clients.ts";

  let id = $state(2);
  // An empty box binds null, which is no id: keep the last one until a number is typed.
  const typeId = (typed: number | null) => {
    if (typed !== null) {
      id = typed;
    }
  };

  // GET /api/todos/:id. A missing todo is a typed 404, TodoNotFound.
  const todo = useAtomSuspense(
    () => TodosHttp.query("todos", "get", { params: { id } }),
    { includeFailure: true }
  );

  // The endpoint's declared errors are its typed errors. A failed request or a
  // response that doesn't decode is a defect, which has none.
  const describe = (cause: Cause.Cause<TodoNotFound>) => {
    const error = Cause.findErrorOption(cause);
    if (Option.isNone(error)) {
      return "Something went wrong.";
    }
    return Match.valueTags(error.value, {
      TodoNotFound: (e) => `TodoNotFound: there is no todo ${e.id}`,
    });
  };
</script>

<p class="flex flex-wrap items-center gap-2">
  <label>
    Todo id
    <input bind:value={() => id, typeId} data-testid="http-id" min="1" type="number" />
  </label>
  {#each [1, 2, 99] as option (option)}
    <button aria-pressed={id === option} onclick={() => (id = option)}>
      {option}
    </button>
  {/each}
</p>

<svelte:boundary>
  {@const result = await todo.current}
  <!-- $effect.pending() counts the boundary's unfinished awaits: the next todo. -->
  {@const busy = $effect.pending() > 0}
  <p>
    {#if result._tag === "Success"}
      <ResultChip {busy} kind="message" label="GET /api/todos/:id" tone="success">
        <span data-testid="http-found">{result.value.title}</span>
      </ResultChip>
    {:else}
      <ResultChip {busy} kind="message" label="GET /api/todos/:id" tone="failure">
        <span data-testid="http-found">{describe(result.cause)}</span>
      </ResultChip>
    {/if}
  </p>
  {#snippet pending()}
    <p>
      <ResultChip kind="message" label="GET /api/todos/:id" tone="running">
        Loading…
      </ResultChip>
    </p>
  {/snippet}
</svelte:boundary>
