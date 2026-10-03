<script lang="ts">
  import { Cause } from "effect";
  import { useAtomSuspense } from "effect-atom-svelte";

  import { TodosRpc } from "#lib/clients.ts";

  let id = $state(1);

  // The same arguments give the same atom, so the getter can call query on every read.
  // includeFailure hands the typed TodoNotFound to the markup instead of the boundary.
  const todo = useAtomSuspense(() => TodosRpc.query("getTodo", { id }), {
    includeFailure: true,
  });
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
      {Cause.pretty(result.cause).split("\n")[0]}
    {/if}
  </p>
  {#snippet pending()}<p>Loading…</p>{/snippet}
</svelte:boundary>
