<script lang="ts">
  import { useAtomRefresh, useAtomSuspense } from "effect-atom-svelte";
  import FlashValue from "#lib/docs/kit/flash-value.svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";

  import { rateAtom } from "./exchange-rate.ts";

  const { name }: { name: string } = $props();

  const rate = useAtomSuspense(rateAtom);
  // Runs the effect again, for every component reading rateAtom.
  const refresh = useAtomRefresh(rateAtom);
</script>

<svelte:boundary>
  <p class="m-0">1 EUR = <FlashValue data-testid="{name}-rate" value={await rate.current} /> USD</p>
  <button class="mt-3" onclick={refresh}>Refresh</button>
  {#snippet pending()}
    <ResultChip kind="message" tone="running">Loading…</ResultChip>
  {/snippet}
</svelte:boundary>
