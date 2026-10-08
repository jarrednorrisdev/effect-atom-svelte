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
        return yield* new TodoNotFound({ message: "There is no todo 99" });
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
  import { useAtom, useAtomSuspense } from "effect-atom-svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";
  // Shows the App.Error the failed snippet receives.
  import ErrorBody from "./error-body.svelte";

  const todo = useAtomSuspense(todoAtom);
  const asked = useAtom(askAtom);

  const asks = [
    ["found", "Todo 1"],
    ["missing", "Todo 99, missing"],
    ["slow", "A slow todo"],
    ["broken", "A broken response"],
  ] as const;

  // The boundary's reset while it shows the failed snippet, so a new ask renders again.
  let reset: (() => void) | undefined;
  const ask = (next: Ask) => {
    asked.current = next;
    reset?.();
    reset = undefined;
  };
</script>

<p aria-label="What to ask for" class="flex flex-wrap gap-2" role="group">
  {#each asks as [name, label] (name)}
    <button aria-pressed={asked.current === name} onclick={() => ask(name)}>
      {label}
    </button>
  {/each}
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
