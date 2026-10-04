<script module lang="ts">
  import { TodosRpc } from "#lib/clients.ts";

  // A streaming RPC: the server sends the numbers 0 to 4, 200 milliseconds apart.
  const ticksAtom = TodosRpc.query("ticks", { count: 5 });
</script>

<script lang="ts">
  import { AsyncResult } from "effect/reactivity";
  import { useAtomRefresh, useAtomSet, useAtomValue } from "effect-atom-svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";
  import ResultHistory from "#lib/docs/kit/result-history.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  const ticks = useAtomValue(ticksAtom);
  const pull = useAtomSet(ticksAtom);
  // Runs the atom again: a new call, and the stream starts over.
  const restart = useAtomRefresh(ticksAtom);
</script>

<p>
  <button
    disabled={ticks.current._tag !== "Success" ||
      ticks.current.value.done ||
      ticks.current.waiting}
    onclick={() => pull()}
  >
    Pull next
  </button>
  <button data-cue="reset" onclick={restart}>Start over</button>
</p>
<div class="flex flex-wrap items-center gap-4">
  {#if ticks.current._tag === "Success"}
    {@const { done, items } = ticks.current.value}
    <ResultChip busy={ticks.current.waiting} label="ticksAtom" tone="success">
      <span data-testid="ticks">{items.join(", ")}{done ? " (done)" : ""}</span>
    </ResultChip>
  {:else}
    <ResultChip kind="message" label="ticksAtom" tone="running">Starting…</ResultChip>
  {/if}
  <StateBadge result={ticks.current} />
</div>
<!-- Each pull's items, timed: wait before a pull and several arrive at once. -->
<ResultHistory
  data-testid="ticks-history"
  label="Pulls"
  result={ticks.current.pipe(AsyncResult.map(({ items }) => items.join(", ")))}
/>
