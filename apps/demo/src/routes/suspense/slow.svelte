<script module lang="ts">
  import { Effect } from "effect";
  import { Atom } from "effect/reactivity";

  // An atom that takes 2 seconds and says how many times it has loaded.
  const makeSlowAtom = () => {
    let loads = 0;
    return Atom.make(
      Effect.sync(() => {
        loads += 1;
        return `Loaded ${loads} time${loads === 1 ? "" : "s"}`;
      }).pipe(Effect.delay("2 seconds"))
    );
  };

  // One atom per side, so a refresh on one side doesn't hold up the other.
  export const plainAtom = makeSlowAtom();
  export const waitingAtom = makeSlowAtom();
</script>

<script lang="ts">
  import { useAtomRefresh, useAtomSuspense } from "effect-atom-svelte";
  import Part from "#lib/docs/kit/part.svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";

  const plain = useAtomSuspense(plainAtom);
  const waiting = useAtomSuspense(waitingAtom, { suspendOnWaiting: true });
  const refreshPlain = useAtomRefresh(plainAtom);
  const refreshWaiting = useAtomRefresh(waitingAtom);

  const refreshBoth = () => {
    refreshPlain();
    refreshWaiting();
  };
</script>

<p><button data-cue="start" onclick={refreshBoth}>Refresh both</button></p>
<div class="grid gap-4 sm:grid-cols-2">
  <Part code label="useAtomSuspense(plainAtom)" top>
    <svelte:boundary>
      <div class="flex flex-wrap items-center gap-3">
        <ResultChip kind="message" tone="success">
          <span data-testid="suspense-value">{await plain.current}</span>
        </ResultChip>
        <span class="text-xs">
          $effect.pending():
          <output data-testid="plain-pending">{$effect.pending()}</output>
        </span>
      </div>
      {#snippet pending()}
        <ResultChip kind="message" tone="running">Loading…</ResultChip>
      {/snippet}
    </svelte:boundary>
  </Part>

  <Part
    code
    label={"useAtomSuspense(waitingAtom, { suspendOnWaiting: true })"}
    top
  >
    <svelte:boundary>
      <div class="flex flex-wrap items-center gap-3">
        <ResultChip busy={$effect.pending() > 0} kind="message" tone="success">
          <span data-testid="held-value">{await waiting.current}</span>
        </ResultChip>
        <span class="text-xs">
          $effect.pending():
          <output data-testid="held-pending">{$effect.pending()}</output>
        </span>
      </div>
      {#snippet pending()}
        <ResultChip kind="message" tone="running">Loading…</ResultChip>
      {/snippet}
    </svelte:boundary>
  </Part>
</div>
