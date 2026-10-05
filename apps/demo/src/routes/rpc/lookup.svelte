<script lang="ts">
  import { useAtomSuspense } from "effect-atom-svelte";
  import CauseView from "#lib/docs/kit/cause-view.svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";

  import { TodosRpc } from "#lib/clients.ts";

  let id = $state(1);

  // The same arguments give the same atom, so the getter can call query on every read.
  // includeFailure hands the typed TodoNotFound to the markup instead of the boundary.
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
  <!-- $effect.pending() counts the boundary's unfinished awaits: the next todo. -->
  {@const busy = $effect.pending() > 0}
  {@const call = `query("getTodo", { id: ${id} })`}
  <div class="mt-3">
    {#if result._tag === "Success"}
      <ResultChip {busy} kind="message" label={call} tone="success">
        <span data-testid="rpc-selected">{result.value.title}</span>
      </ResultChip>
    {:else}
      <!-- Todo 99 doesn't exist: the procedure fails with its typed TodoNotFound. -->
      <div aria-busy={busy}>
        <CauseView cause={result.cause} code data-testid="rpc-selected" label={call} />
      </div>
    {/if}
  </div>
  {#snippet pending()}
    <p>
      <ResultChip kind="message" label="getTodo" tone="running">Loading…</ResultChip>
    </p>
  {/snippet}
</svelte:boundary>
