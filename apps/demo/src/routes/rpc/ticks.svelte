<script module lang="ts">
  import { TodosRpc } from "#lib/clients.ts";

  // A streaming RPC: the server sends the numbers 0 to 4, 200 milliseconds apart.
  const ticksAtom = TodosRpc.query("ticks", { count: 5 });
</script>

<script lang="ts">
  import { useAtomSet, useAtomValue } from "effect-atom-svelte";

  const ticks = useAtomValue(ticksAtom);
  const pull = useAtomSet(ticksAtom);
</script>

{#if ticks.current._tag === "Success"}
  <p data-testid="ticks">
    {ticks.current.value.items.join(", ")}{ticks.current.value.done ? " (done)" : ""}
  </p>
  <button
    disabled={ticks.current.value.done || ticks.current.waiting}
    onclick={() => pull()}
  >
    Pull next
  </button>
{:else}
  <p>{ticks.current._tag}</p>
{/if}
