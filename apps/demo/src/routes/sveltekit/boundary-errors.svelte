<script module lang="ts">
  import { Data, Effect } from "effect";
  import { Atom } from "effect/reactivity";

  class TodoNotFound extends Data.TaggedError("TodoNotFound")<{
    readonly message: string;
  }> {}
  class Timeout extends Data.TaggedError("Timeout")<{ readonly message: string }> {}

  type Ask = "found" | "missing" | "slow" | "broken";
  const askAtom = Atom.make<Ask>("found");

  // Fails with a typed error, or dies with a plain one, depending on what was asked.
  const todoAtom = Atom.make((get) => {
    const ask = get(askAtom);
    return Effect.gen(function* fetchTodo() {
      yield* Effect.sleep("400 millis");
      if (ask === "missing") {
        return yield* new TodoNotFound({ message: "There is no todo 7" });
      }
      if (ask === "slow") {
        return yield* new Timeout({ message: "No answer within 5 seconds" });
      }
      if (ask === "broken") {
        return yield* Effect.die(new Error("The response was not JSON"));
      }
      return "Write the docs";
    });
  });
</script>

<script lang="ts">
  import { useAtomSet, useAtomSuspense } from "effect-atom-svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";
  // Shows the App.Error the failed snippet receives.
  import ErrorBody from "./error-body.svelte";

  const todo = useAtomSuspense(todoAtom);
  const setAsk = useAtomSet(askAtom);

  // The boundary's reset while it shows the failed snippet, so a new ask renders again.
  let reset: (() => void) | undefined;
  const ask = (next: Ask) => {
    setAsk(next);
    reset?.();
    reset = undefined;
  };
</script>

<p>
  <button onclick={() => ask("found")}>Todo 1</button>
  <button onclick={() => ask("missing")}>Todo 7, missing</button>
  <button onclick={() => ask("slow")}>A slow todo</button>
  <button onclick={() => ask("broken")}>A broken response</button>
</p>
<!-- With a pending snippet, the server never waits for the atom. See the caution. -->
<svelte:boundary onerror={(_, retry) => (reset = retry)}>
  <ResultChip kind="message" label="todoAtom" tone="success">
    <span data-testid="boundary-todo">{await todo.current}</span>
  </ResultChip>
  {#snippet pending()}
    <ResultChip kind="message" label="todoAtom" tone="running">Loading…</ResultChip>
  {/snippet}
  {#snippet failed(error)}
    {@const { message, tag } = error as App.Error}
    <ResultChip kind="message" label="failed snippet" tone="failure">
      <span data-testid="boundary-failed">
        {#if tag === "TodoNotFound"}
          No such todo.
        {:else if tag === "Timeout"}
          The server took too long. Try again later.
        {:else}
          {message}
        {/if}
      </span>
    </ResultChip>
    <ErrorBody {error} />
  {/snippet}
</svelte:boundary>
