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
  import { useAtom, useAtomValue } from "effect-atom-svelte";
  import CauseView from "#lib/docs/kit/cause-view.svelte";
  import EffectType from "#lib/docs/kit/effect-type.svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  const id = useAtom(idAtom);
  const recover = useAtom(recoverAtom);
  const todo = useAtomValue(todoAtom);
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
<!-- With catchTag, NotFound leaves the error type. -->
<p class="mb-3 flex flex-wrap items-center gap-3">
  <EffectType
    error={recover.current ? ["Forbidden"] : ["NotFound", "Forbidden"]}
    name="todoAtom"
    result={todo.current}
    success="string"
  />
  <StateBadge data-testid="catch-tag-state" result={todo.current} />
</p>
{#if todo.current._tag === "Success"}
  <ResultChip kind="message" label="todoAtom" tone="success">
    <span data-testid="catch-tag">{todo.current.value}</span>
  </ResultChip>
{:else if todo.current._tag === "Failure"}
  <CauseView cause={todo.current.cause} code data-testid="catch-tag" label="todoAtom" />
{/if}
