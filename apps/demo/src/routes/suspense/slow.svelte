<script module lang="ts">
  import { Effect } from "effect";
  import { Atom } from "effect/reactivity";

  // An atom that takes 800 ms and says how many times it has loaded.
  const makeSlowAtom = () => {
    let loads = 0;
    return Atom.make(
      Effect.sync(() => {
        loads += 1;
        return `Loaded ${loads} time${loads === 1 ? "" : "s"}`;
      }).pipe(Effect.delay("800 millis"))
    );
  };

  // One atom per side, so a refresh on one side doesn't hold up the other.
  const plainAtom = makeSlowAtom();
  const heldAtom = makeSlowAtom();
</script>

<script lang="ts">
  import { useAtomRefresh, useAtomSuspense } from "effect-atom-svelte";
  import Part from "#lib/docs/kit/part.svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";
  import Trace from "./trace.svelte";

  const plain = useAtomSuspense(plainAtom);
  const held = useAtomSuspense(heldAtom, { suspendOnWaiting: true });
  const refreshPlain = useAtomRefresh(plainAtom);
  const refreshHeld = useAtomRefresh(heldAtom);
</script>

<div class="grid gap-4 sm:grid-cols-2">
  <Part code label="default">
    <button aria-label="Refresh default" onclick={refreshPlain}>Refresh</button>
    <svelte:boundary>
      <div class="mt-3 flex flex-wrap items-center gap-3">
        <ResultChip kind="message" tone="success">
          <span data-testid="suspense-value">{await plain.current}</span>
        </ResultChip>
        <span class="text-xs">
          $effect.pending():
          <output data-testid="plain-pending">{$effect.pending()}</output>
        </span>
      </div>
      {#snippet pending()}
        <p class="mt-3">
          <ResultChip kind="message" tone="running">Loading…</ResultChip>
        </p>
      {/snippet}
    </svelte:boundary>
    <!-- Beside the example: the atom's AsyncResult, and when the await resolved. -->
    <Trace atom={plainAtom} name="plainAtom" read={() => plain.current} />
  </Part>

  <Part code label="suspendOnWaiting: true">
    <button aria-label="Refresh suspendOnWaiting" onclick={refreshHeld}>
      Refresh
    </button>
    <svelte:boundary>
      <div class="mt-3 flex flex-wrap items-center gap-3">
        <ResultChip busy={$effect.pending() > 0} kind="message" tone="success">
          <span data-testid="held-value">{await held.current}</span>
        </ResultChip>
        <span class="text-xs">
          $effect.pending():
          <output data-testid="held-pending">{$effect.pending()}</output>
        </span>
      </div>
      {#snippet pending()}
        <p class="mt-3">
          <ResultChip kind="message" tone="running">Loading…</ResultChip>
        </p>
      {/snippet}
    </svelte:boundary>
    <Trace atom={heldAtom} name="heldAtom" read={() => held.current} />
  </Part>
</div>
