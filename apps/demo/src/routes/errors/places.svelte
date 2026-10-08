<script module lang="ts">
  import { Data, Effect } from "effect";
  import { Atom } from "effect/reactivity";

  class NotFound extends Data.TaggedError("NotFound")<{
    readonly id: number;
  }> {}

  const titles = new Map([
    [1, "Write the docs"],
    [2, "Water the plants"],
  ]);

  const idAtom = Atom.make(1);

  // Fails with NotFound for an id that has no todo.
  const todoAtom = Atom.make((get) => {
    const id = get(idAtom);
    const title = titles.get(id);
    return title === undefined
      ? Effect.fail(new NotFound({ id }))
      : Effect.succeed(title);
  });
</script>

<script lang="ts">
  import {
    useAtom,
    useAtomRefresh,
    useAtomSuspense,
    useAtomValue,
  } from "effect-atom-svelte";
  import CauseView from "#lib/docs/kit/cause-view.svelte";
  import Part from "#lib/docs/kit/part.svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  const id = useAtom(idAtom);
  // 1. The AsyncResult itself, failures included.
  const asResult = useAtomValue(todoAtom);
  // 2. Rejects on failure, so the boundary's failed snippet takes over.
  const asPromise = useAtomSuspense(todoAtom);
  // 3. Resolves with the Success or the Failure, and never rejects.
  const inPlace = useAtomSuspense(todoAtom, { includeFailure: true });
  // reset alone would render the same Failure again: refresh the atom first.
  const refresh = useAtomRefresh(todoAtom);
</script>

<div aria-label="Todo" class="flex flex-wrap gap-2" role="group">
  {#each [1, 2, 99] as todoId (todoId)}
    <button
      aria-pressed={id.current === todoId}
      onclick={() => (id.current = todoId)}
    >
      Todo {todoId}
    </button>
  {/each}
</div>

<div class="mt-3 grid gap-3 md:grid-cols-3">
  <Part code label="useAtomValue">
    <StateBadge data-testid="places-result-state" result={asResult.current} />
    {#if asResult.current._tag === "Failure"}
      <CauseView cause={asResult.current.cause} data-testid="places-result" />
    {:else if asResult.current._tag === "Success"}
      <p data-testid="places-result">{asResult.current.value}</p>
    {/if}
  </Part>

  <Part code label="boundary">
    <svelte:boundary>
      <ResultChip kind="message" tone="success">
        <span data-testid="places-boundary">{await asPromise.current}</span>
      </ResultChip>
      {#snippet failed(error, reset)}
        <!-- What SvelteKit's handleError hook kept: the tag, but not the id. -->
        {@const kept = error as App.Error}
        <ResultChip kind="message" tone="failure">
          <span data-testid="places-boundary">{kept.tag}</span>
        </ResultChip>
        <p class="text-sm break-all">
          Received <code data-testid="places-received">{JSON.stringify(kept)}</code>
        </p>
        <button
          onclick={() => {
            refresh();
            reset();
          }}
        >
          Try again
        </button>
      {/snippet}
    </svelte:boundary>
  </Part>

  <Part code label="includeFailure">
    <svelte:boundary>
      {@const result = await inPlace.current}
      {#if result._tag === "Success"}
        <ResultChip kind="message" tone="success">
          <span data-testid="places-in-place">{result.value}</span>
        </ResultChip>
      {:else}
        <CauseView cause={result.cause} data-testid="places-in-place" />
      {/if}
    </svelte:boundary>
  </Part>
</div>
