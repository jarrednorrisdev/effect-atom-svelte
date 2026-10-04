<script module lang="ts">
  import { Data, Effect } from "effect";
  import { Atom } from "effect/reactivity";

  class NotFound extends Data.TaggedError("NotFound")<{ readonly id: number }> {}
  class Forbidden extends Data.TaggedError("Forbidden") {}

  type Outcome = "success" | "notFound" | "forbidden" | "defect" | "interrupt";

  // Stand-ins for a request, one for each way it can end.
  const requests: Record<Outcome, Effect.Effect<string, NotFound | Forbidden>> = {
    defect: Effect.die(new Error("todos is undefined")),
    forbidden: Effect.fail(new Forbidden()),
    interrupt: Effect.interrupt,
    notFound: Effect.fail(new NotFound({ id: 7 })),
    success: Effect.succeed("Write the docs"),
  };

  const choices: readonly (readonly [Outcome, string])[] = [
    ["success", "Succeed"],
    ["notFound", "Fail with NotFound"],
    ["forbidden", "Fail with Forbidden"],
    ["defect", "Die with a defect"],
    ["interrupt", "Be interrupted"],
  ];

  const outcomeAtom = Atom.make<Outcome>("notFound");
  const todoAtom = Atom.make((get) => requests[get(outcomeAtom)]);
</script>

<script lang="ts">
  import { Match } from "effect";
  import { AsyncResult } from "effect/reactivity";
  import { useAtom, useAtomValue } from "effect-atom-svelte";
  import CauseView from "#lib/docs/kit/cause-view.svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

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

<div
  aria-label="How the request ends"
  class="flex flex-wrap gap-2"
  data-testid="outcome"
  role="group"
>
  {#each choices as [value, text] (value)}
    <button
      aria-pressed={outcome.current === value}
      onclick={() => (outcome.current = value)}
    >
      {text}
    </button>
  {/each}
</div>

<div class="flex flex-wrap items-baseline gap-4">
  <ResultChip
    kind="message"
    label="todoAtom"
    tone={todo.current._tag === "Success" ? "success" : "failure"}
  >
    <span data-testid="outcome-message">{message}</span>
  </ResultChip>
  <StateBadge data-testid="outcome-state" result={todo.current} />
</div>
<CauseView
  cause={todo.current._tag === "Failure" ? todo.current.cause : undefined}
  data-testid="outcome-cause"
/>
