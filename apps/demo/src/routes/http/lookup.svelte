<script lang="ts">
  import type { TodoNotFound } from "@demo/domain";
  import { Cause, Match, Option } from "effect";
  import { useAtomSuspense } from "effect-atom-svelte";

  import { TodosHttp } from "#lib/clients.ts";

  let id = $state(2);

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

<label>
  Todo id
  <input bind:value={id} data-testid="http-id" min="1" type="number" />
</label>

<svelte:boundary>
  {@const result = await todo.current}
  <p data-testid="http-found">
    {#if result._tag === "Success"}
      {result.value.title}
    {:else}
      {describe(result.cause)}
    {/if}
  </p>
  {#snippet pending()}<p>Loading…</p>{/snippet}
</svelte:boundary>
