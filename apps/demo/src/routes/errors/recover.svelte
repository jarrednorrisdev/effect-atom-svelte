<script module lang="ts">
  import { Data, Effect } from "effect";
  import { Atom } from "effect/reactivity";

  class NotFound extends Data.TaggedError("NotFound")<{ readonly id: number }> {}

  const titles = new Map([[1, "Write the docs"]]);

  // A missing todo is a typed error.
  const fetchTodo = (id: number): Effect.Effect<string, NotFound> => {
    const title = titles.get(id);
    return title === undefined
      ? Effect.fail(new NotFound({ id }))
      : Effect.succeed(title);
  };

  const idAtom = Atom.make(2);

  // AsyncResult<string, NotFound>
  const todoAtom = Atom.make((get) => fetchTodo(get(idAtom)));

  // AsyncResult<string | null, never>: NotFound is handled before the atom sees it.
  const recoveredAtom = Atom.make((get) =>
    fetchTodo(get(idAtom)).pipe(
      Effect.catchTag("NotFound", () => Effect.succeed(null))
    )
  );
</script>

<script lang="ts">
  import { useAtom, useAtomValue } from "effect-atom-svelte";
  import Part from "#lib/docs/kit/part.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  const id = useAtom(idAtom);
  const todo = useAtomValue(todoAtom);
  const recovered = useAtomValue(recoveredAtom);
</script>

<select aria-label="Todo id" bind:value={id.current} data-testid="recover-id">
  <option value={1}>Todo 1</option>
  <option value={2}>Todo 2, which doesn't exist</option>
</select>

<div class="mt-3 grid gap-3 sm:grid-cols-2">
  <Part code label="todoAtom">
    <StateBadge data-testid="recover-plain-state" result={todo.current} />
    <p data-testid="recover-plain">
      {#if todo.current._tag === "Success"}
        {todo.current.value}
      {:else if todo.current._tag === "Failure"}
        Failed, so the page has to handle NotFound.
      {/if}
    </p>
  </Part>
  <Part code label="recoveredAtom">
    <StateBadge data-testid="recover-caught-state" result={recovered.current} />
    <p data-testid="recover-caught">
      {#if recovered.current._tag === "Success"}
        {recovered.current.value ?? "null: no todo yet, and nothing to handle."}
      {/if}
    </p>
  </Part>
</div>
