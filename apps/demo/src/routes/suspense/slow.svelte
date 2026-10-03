<script module lang="ts">
  import { Effect } from "effect";
  import { Atom } from "effect/reactivity";

  let loads = 0;
  const slowAtom = Atom.make(
    Effect.sync(() => {
      loads += 1;
      return `Loaded ${loads} time${loads === 1 ? "" : "s"}`;
    }).pipe(Effect.delay("800 millis"))
  );
</script>

<script lang="ts">
  import { useAtomRefresh, useAtomSuspense } from "effect-atom-svelte";

  const slow = useAtomSuspense(slowAtom);
  const slowAgain = useAtomSuspense(slowAtom, { suspendOnWaiting: true });
  const refresh = useAtomRefresh(slowAtom);
</script>

<p><button onclick={refresh}>Refresh</button></p>

<svelte:boundary>
  <p>Default: <output data-testid="suspense-value">{await slow.current}</output></p>
  {#snippet pending()}<p>Loading…</p>{/snippet}
</svelte:boundary>

<svelte:boundary>
  <p>suspendOnWaiting: <output>{await slowAgain.current}</output></p>
  {#snippet pending()}<p>Loading…</p>{/snippet}
</svelte:boundary>
