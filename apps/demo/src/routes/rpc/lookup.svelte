<script lang="ts">
  import type { TodoNotFound } from "@demo/domain";
  import { Cause, Match, Option } from "effect";
  import type { RpcClientError } from "effect/rpc";
  import { useAtomSuspense } from "effect-atom-svelte";

  import { TodosRpc } from "#lib/clients.ts";

  let id = $state(1);

  // The same arguments give the same atom, so the getter can call query on every read.
  // includeFailure hands the typed TodoNotFound to the markup instead of the boundary.
  const todo = useAtomSuspense(() => TodosRpc.query("getTodo", { id }), {
    includeFailure: true,
  });

  type LookupError = TodoNotFound | RpcClientError.RpcClientError;

  // Find the typed error and match its _tag. A defect or an interruption has none.
  const describe = (cause: Cause.Cause<LookupError>) => {
    const error = Cause.findErrorOption(cause);
    if (Option.isNone(error)) {
      return "Something went wrong.";
    }
    return Match.valueTags(error.value, {
      RpcClientError: (e) => `Could not reach the server: ${e.message}`,
      TodoNotFound: (e) => `TodoNotFound: there is no todo ${e.id}`,
    });
  };
</script>

<select bind:value={id} data-testid="rpc-select">
  <option value={1}>Todo 1</option>
  <option value={2}>Todo 2</option>
  <option value={99}>Todo 99, which doesn't exist</option>
</select>

<svelte:boundary>
  {@const result = await todo.current}
  <p data-testid="rpc-selected">
    {#if result._tag === "Success"}
      {result.value.title}
    {:else}
      {describe(result.cause)}
    {/if}
  </p>
  {#snippet pending()}<p>Loading…</p>{/snippet}
</svelte:boundary>
