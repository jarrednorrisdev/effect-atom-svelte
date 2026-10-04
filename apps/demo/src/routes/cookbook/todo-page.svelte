<!-- As src/routes/todos/[id]/+page.svelte. SvelteKit passes every page
     its route's params (page.params); here, the addresses above do. -->
<script lang="ts">
  import type { TodoNotFound } from "@demo/domain";
  import { Cause, Option } from "effect";
  import type { RpcClientError } from "effect/rpc";
  import { useAtomSuspense } from "effect-atom-svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";

  import { TodosRpc } from "#lib/clients.ts";

  const { params }: { params: { id: string } } = $props();

  // Read inside the getter, so the hook follows params.id.
  const todo = useAtomSuspense(
    () => TodosRpc.query("getTodo", { id: Number(params.id) }),
    { includeFailure: true }
  );

  const describe = (
    cause: Cause.Cause<TodoNotFound | RpcClientError.RpcClientError>
  ) => {
    const error = Cause.findErrorOption(cause);
    return Option.isSome(error) && error.value._tag === "TodoNotFound"
      ? `There is no todo ${error.value.id}.`
      : "Could not load the todo.";
  };
</script>

<svelte:boundary>
  {@const result = await todo.current}
  <!-- $effect.pending() counts unfinished awaits: the next todo. -->
  {@const busy = $effect.pending() > 0}
  {#if result._tag === "Success"}
    <ResultChip {busy} kind="message" label="getTodo" tone="success">
      <span data-testid="route-todo">{result.value.title}</span>
    </ResultChip>
  {:else}
    <ResultChip {busy} kind="message" label="getTodo" tone="failure">
      <span data-testid="route-todo">{describe(result.cause)}</span>
    </ResultChip>
  {/if}
  {#snippet pending()}
    <ResultChip kind="message" label="getTodo" tone="running">
      Loading…
    </ResultChip>
  {/snippet}
</svelte:boundary>
