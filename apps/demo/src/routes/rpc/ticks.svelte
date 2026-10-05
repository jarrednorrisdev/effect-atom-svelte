<script module lang="ts">
  import { TodosRpc } from "#lib/clients.ts";

  // A streaming RPC: the server sends the numbers 0 to 4, half a second apart.
  const ticksAtom = TodosRpc.query("ticks", { count: 5 });
</script>

<script lang="ts">
  import { useAtomRefresh, useAtomSet, useAtomValue } from "effect-atom-svelte";
  import Chunks from "#lib/docs/kit/chunks.svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  const ticks = useAtomValue(ticksAtom);
  const pull = useAtomSet(ticksAtom);
  // Runs the atom again: a new call, and the stream starts over.
  const refresh = useAtomRefresh(ticksAtom);

  // Until the new call's first numbers arrive, the atom keeps the old ones,
  // waiting. They are hidden meanwhile, so the pulls start afresh.
  let restarting = $state(false);
  const restart = () => {
    restarting = true;
    refresh();
  };
  $effect(() => {
    if (!ticks.current.waiting) {
      restarting = false;
    }
  });
</script>

<p class="flex flex-wrap items-center gap-2">
  <button
    disabled={ticks.current._tag !== "Success" ||
      ticks.current.value.done ||
      ticks.current.waiting}
    onclick={() => pull()}
  >
    Pull next
  </button>
  <button data-cue="reset" onclick={restart}>Start over</button>
  <StateBadge result={ticks.current} />
</p>
{#if ticks.current._tag === "Success" && !restarting}
  {@const { done, items } = ticks.current.value}
  <!-- Each pull's numbers together: wait before a pull and several arrive at once. -->
  <Chunks data-testid="ticks" end={done ? "done" : undefined} {items} />
{:else}
  <ResultChip kind="message" label="ticksAtom" tone="running">Starting…</ResultChip>
{/if}
