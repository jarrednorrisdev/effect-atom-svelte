<script module lang="ts">
  import { Data, Effect } from "effect";
  import { Atom } from "effect/reactivity";

  class AlwaysFails extends Data.TaggedError("AlwaysFails")<{
    readonly message: string;
  }> {}

  const failingAtom = Atom.make(
    Effect.fail(new AlwaysFails({ message: "This atom always fails" }))
  );
</script>

<script lang="ts">
  import { useAtomSuspense } from "effect-atom-svelte";

  const failing = useAtomSuspense(failingAtom);
</script>

<svelte:boundary>
  <p>{await failing.current}</p>
  {#snippet pending()}<p>Loading…</p>{/snippet}
  {#snippet failed(error)}
    <!-- SvelteKit passes the error through its handleError hook, which keeps the
         message and _tag. -->
    <p data-testid="suspense-failed">{(error as App.Error).message}</p>
    <p data-testid="suspense-failed-tag">{(error as App.Error).tag}</p>
  {/snippet}
</svelte:boundary>
