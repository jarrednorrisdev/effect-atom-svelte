<script module lang="ts">
  import { Data, Effect } from "effect";
  import { Atom } from "effect/reactivity";

  class NotFound extends Data.TaggedError("NotFound")<{
    readonly id: number;
  }> {}

  class Forbidden extends Data.TaggedError("Forbidden") {}

  // The first exists, the second doesn't, and the third is someone else's.
  const getTodo = (id: number): Effect.Effect<string, NotFound | Forbidden> => {
    switch (id) {
      case 1: {
        return Effect.succeed("Write the docs");
      }
      case 2: {
        return Effect.fail(new NotFound({ id }));
      }
      default: {
        return Effect.fail(new Forbidden());
      }
    }
  };

  const idAtom = Atom.make(1);
  const recoverAtom = Atom.make(false);

  const todoAtom = Atom.make((get) => {
    const todo = getTodo(get(idAtom));
    // catchTag handles NotFound, and leaves Forbidden in the error type:
    // Effect<string, Forbidden, never>
    const recovered = todo.pipe(
      Effect.catchTag("NotFound", (notFound) =>
        Effect.succeed(`(there is no todo ${notFound.id})`)
      )
    );
    return get(recoverAtom) ? recovered : todo;
  });
</script>

<script lang="ts">
  import { Cause, Option } from "effect";
  import { useAtom, useAtomValue } from "effect-atom-svelte";
  import FlashValue from "#lib/docs/kit/flash-value.svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";

  const id = useAtom(idAtom);
  const recover = useAtom(recoverAtom);
  const todo = useAtomValue(todoAtom);

  // The typed error's _tag, if the effect failed with one.
  const errorTag = (cause: Cause.Cause<NotFound | Forbidden>) =>
    Option.match(Cause.findErrorOption(cause), {
      onNone: () => "no typed error",
      onSome: (error) => error._tag,
    });
</script>

<div aria-label="Todo" class="flex flex-wrap gap-2" role="group">
  {#each [1, 2, 3] as todoId (todoId)}
    <button aria-pressed={id.current === todoId} onclick={() => (id.current = todoId)}>
      Todo {todoId}
    </button>
  {/each}
</div>
<p>
  <button
    aria-pressed={recover.current}
    onclick={() => (recover.current = !recover.current)}
  >
    <code>Effect.catchTag("NotFound", …)</code>
  </button>
</p>
<p class="text-sm">
  Error type:
  <FlashValue
    data-testid="catch-tag-type"
    value={recover.current ? "Forbidden" : "NotFound | Forbidden"}
  />
</p>
<p>
  {#if todo.current._tag === "Success"}
    <ResultChip kind="message" label="todoAtom" tone="success">
      <span data-testid="catch-tag">{todo.current.value}</span>
    </ResultChip>
  {:else if todo.current._tag === "Failure"}
    <ResultChip kind="message" label="todoAtom" tone="failure">
      <span data-testid="catch-tag">Failed with {errorTag(todo.current.cause)}</span>
    </ResultChip>
  {/if}
</p>
