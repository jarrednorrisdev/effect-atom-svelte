<script module lang="ts">
  import { Data, Effect } from "effect";
  import { Atom } from "effect/reactivity";

  class NotFound extends Data.TaggedError("NotFound")<{ readonly id: number }> {}
  class Forbidden extends Data.TaggedError("Forbidden") {}

  type Outcome = "success" | "notFound" | "forbidden" | "defect";

  // Stand-ins for a request, one for each way it can end.
  const requests: Record<Outcome, Effect.Effect<string, NotFound | Forbidden>> = {
    defect: Effect.die(new Error("todos is undefined")),
    forbidden: Effect.fail(new Forbidden()),
    notFound: Effect.fail(new NotFound({ id: 7 })),
    success: Effect.succeed("Write the docs"),
  };

  const outcomeAtom = Atom.make<Outcome>("notFound");
  const todoAtom = Atom.make((get) => requests[get(outcomeAtom)]);
</script>

<script lang="ts">
  import { Match } from "effect";
  import { AsyncResult } from "effect/reactivity";
  import { useAtom, useAtomValue } from "effect-atom-svelte";

  const outcome = useAtom(outcomeAtom);
  const todo = useAtomValue(todoAtom);

  // onError gets the typed error, so matching on _tag is checked by TypeScript.
  // Anything else (a defect or an interruption) goes to onDefect.
  const message = $derived(
    AsyncResult.matchWithError(todo.current, {
      onDefect: (defect) => `Something went wrong: ${String(defect)}`,
      onError: (error) =>
        Match.valueTags(error, {
          Forbidden: () => "Forbidden: you can't see this todo",
          NotFound: (e) => `NotFound: there is no todo ${e.id}`,
        }),
      onInitial: () => "Loading…",
      onSuccess: (success) => success.value,
    })
  );
</script>

<p>
  <select bind:value={outcome.current} data-testid="outcome">
    <option value="success">Succeed</option>
    <option value="notFound">Fail with NotFound</option>
    <option value="forbidden">Fail with Forbidden</option>
    <option value="defect">Die with a defect</option>
  </select>
</p>
<p><output data-testid="outcome-message">{message}</output></p>
