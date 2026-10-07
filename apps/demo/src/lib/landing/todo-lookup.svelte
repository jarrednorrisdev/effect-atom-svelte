<script lang="ts">
  import { Option } from "effect";
  import { AsyncResult } from "effect/reactivity";
  import { useAtomSuspense } from "effect-atom-svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";

  import { TodosRpc } from "#lib/clients.ts";

  let id = $state(1);

  // Typed by the server's RpcGroup: a Todo, or a TodoNotFound failure.
  const todo = useAtomSuspense(() => TodosRpc.query("getTodo", { id }), {
    includeFailure: true,
  });
</script>

<div aria-label="Todo" class="flex flex-wrap gap-2" role="group">
  {#each [1, 2, 99] as option (option)}
    <button aria-pressed={id === option} onclick={() => (id = option)}>
      Todo {option}
    </button>
  {/each}
</div>

<svelte:boundary>
  {@const result = await todo.current}
  {@const error = AsyncResult.error(result)}
  {@const busy = $effect.pending() > 0}
  <div class="mt-3" data-testid="lookup">
    {#if result._tag === "Success"}
      <ResultChip {busy} kind="message" tone="success">{result.value.title}</ResultChip>
    {:else if Option.isSome(error) && error.value._tag === "TodoNotFound"}
      <ResultChip {busy} kind="message" tone="failure">
        There is no todo {error.value.id}
      </ResultChip>
    {:else}
      <ResultChip {busy} kind="message" tone="failure">Couldn't reach the server</ResultChip>
    {/if}
  </div>
  {#snippet pending()}
    <div class="mt-3">
      <ResultChip kind="message" tone="running">Loading…</ResultChip>
    </div>
  {/snippet}
</svelte:boundary>
