<script module lang="ts">
  import { Data, Effect } from "effect";
  import { Atom } from "effect/reactivity";

  let calls = 0;
  const slowAtom = Atom.make(
    Effect.sync(() => {
      calls += 1;
      return `loaded ${calls} time${calls === 1 ? "" : "s"}`;
    }).pipe(Effect.delay("800 millis"))
  );
  class AlwaysFails extends Data.TaggedError("AlwaysFails")<{ readonly message: string }> {}
  const failingAtom = Atom.make(
    Effect.fail(new AlwaysFails({ message: "This atom always fails" }))
  );
</script>

<script lang="ts">
  import { useAtomRefresh, useAtomSuspense } from "effect-atom-svelte";

  const slow = useAtomSuspense(slowAtom);
  const slowSuspending = useAtomSuspense(slowAtom, { suspendOnWaiting: true });
  const refresh = useAtomRefresh(slowAtom);
  const failing = useAtomSuspense(failingAtom);
</script>

<h1>Suspense</h1>

<section>
  <h2>Await in markup</h2>
  <p>
    The boundary's <code>pending</code> snippet shows on first load. On refresh the old value stays
    until the new one arrives.
  </p>
  <button onclick={refresh}>Refresh</button>
  <svelte:boundary>
    <p data-testid="suspense-value">{await slow.current}</p>
    {#snippet pending()}<p>Loading…</p>{/snippet}
  </svelte:boundary>
</section>

<section>
  <h2>suspendOnWaiting</h2>
  <p>
    The same atom read with <code>suspendOnWaiting</code>: a refresh issues a pending promise again,
    so Svelte keeps showing the previous value until the refetch settles, then updates both.
  </p>
  <svelte:boundary>
    <p>{await slowSuspending.current}</p>
    {#snippet pending()}<p>Loading…</p>{/snippet}
  </svelte:boundary>
</section>

<section>
  <h2>Failures reach the boundary</h2>
  <p>
    A failed atom rejects its promise, and the boundary renders its <code>failed</code> snippet. The
    <code>handleError</code> hooks from <code>effect-atom-svelte/sveltekit</code> keep the error's
    message and <code>_tag</code>.
  </p>
  <svelte:boundary>
    <p>{await failing.current}</p>
    {#snippet pending()}<p>Loading…</p>{/snippet}
    {#snippet failed(error)}
      <p data-testid="suspense-failed">{(error as App.Error).message}</p>
      <p data-testid="suspense-failed-tag">{(error as App.Error).tag}</p>
    {/snippet}
  </svelte:boundary>
</section>
