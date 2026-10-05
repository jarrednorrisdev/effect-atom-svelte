<script module lang="ts">
  import { Data, Effect } from "effect";
  import { Atom } from "effect/reactivity";

  class TitleTooLong extends Data.TaggedError("TitleTooLong")<{
    readonly max: number;
  }> {}

  let lastId = 0;

  // A pretend save that takes a second, as a request would, and fails with
  // TitleTooLong when the title is over 60 characters.
  const saveTodo = (title: string) =>
    Effect.gen(function* save() {
      yield* Effect.sleep("1 second");
      if (title.length > 60) {
        return yield* new TitleTooLong({ max: 60 });
      }
      lastId += 1;
      return { id: lastId, title };
    });

  // Each write runs saveTodo with the title written.
  const createAtom = Atom.fn((title: string) => saveTodo(title));
</script>

<script lang="ts">
  import { Exit } from "effect";
  import { useAtomSet, useAtomValue } from "effect-atom-svelte";
  import CauseView from "#lib/docs/kit/cause-view.svelte";
  import EffectType from "#lib/docs/kit/effect-type.svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  // Reading gives the mutation's AsyncResult; the setter runs it.
  const creating = useAtomValue(createAtom);
  const create = useAtomSet(createAtom, { mode: "promiseExit" });

  let title = $state("Water the plants");

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    const exit = await create(title);
    // Only a success clears the input; after a failure it keeps what you typed.
    if (Exit.isSuccess(exit)) {
      title = "";
    }
  };
</script>

<form class="flex flex-wrap items-center gap-2" onsubmit={submit}>
  <input aria-label="New todo" bind:value={title} data-testid="add-draft" />
  <button data-testid="add-submit" disabled={creating.current.waiting}>
    {creating.current.waiting ? "Adding…" : "Add"}
  </button>
  <button onclick={() => (title = "x".repeat(70))} type="button">
    Paste a long title
  </button>
</form>
<p class="mt-4 mb-3 flex flex-wrap items-center gap-3">
  <EffectType
    error="TitleTooLong"
    name="createAtom"
    result={creating.current}
    success={"{ id, title }"}
  />
  <StateBadge data-testid="add-state" result={creating.current} />
</p>
{#if creating.current._tag === "Success"}
  {@const todo = creating.current.value}
  <ResultChip kind="message" label="createAtom" tone="success">
    <span data-testid="add-created">#{todo.id} {todo.title}</span>
  </ResultChip>
{:else if creating.current._tag === "Failure"}
  <CauseView
    cause={creating.current.cause}
    code
    data-testid="add-error"
    label="createAtom"
  />
{/if}
