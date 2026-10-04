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
  import ResultChip from "#lib/docs/kit/result-chip.svelte";

  const failing = useAtomSuspense(failingAtom);
</script>

<svelte:boundary>
  <p>{await failing.current}</p>
  {#snippet pending()}
    <ResultChip kind="message" label="failingAtom" tone="running">
      Loading…
    </ResultChip>
  {/snippet}
  {#snippet failed(error)}
    <!-- SvelteKit passes the error through its handleError hook. This site's hooks,
         from effect-atom-svelte/sveltekit, keep the message and add the tag. -->
    <ResultChip kind="message" label="failed snippet" tone="failure">
      <span data-testid="suspense-failed">{(error as App.Error).message}</span>
    </ResultChip>
    <p class="mt-2 text-sm">
      tag: <code data-testid="suspense-failed-tag">{(error as App.Error).tag}</code>
    </p>
  {/snippet}
</svelte:boundary>
