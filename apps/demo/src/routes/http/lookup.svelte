<script lang="ts">
  import { Cause } from "effect";
  import { useAtomSuspense } from "effect-atom-svelte";

  import { TodosHttp } from "#lib/clients.ts";

  let id = $state(2);

  // GET /api/todos/:id. A missing todo is a typed 404, TodoNotFound.
  const todo = useAtomSuspense(
    () => TodosHttp.query("todos", "get", { params: { id } }),
    { includeFailure: true }
  );
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
      {Cause.pretty(result.cause).split("\n")[0]}
    {/if}
  </p>
  {#snippet pending()}<p>Loading…</p>{/snippet}
</svelte:boundary>
