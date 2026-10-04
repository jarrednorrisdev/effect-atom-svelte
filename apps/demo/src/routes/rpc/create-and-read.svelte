<script module lang="ts">
  import { Effect } from "effect";
  import { EventLogState } from "#lib/docs/kit/event-log.svelte.ts";

  import { TodosRpc } from "#lib/clients.ts";

  // Each call the effect makes, for the log under the example.
  const calls = new EventLogState();

  // Two calls in one effect: getTodo needs the id that createTodo returns.
  const createAndReadAtom = TodosRpc.runtime.fn((title: string) =>
    Effect.gen(function* createThenRead() {
      const client = yield* TodosRpc;
      calls.add("createTodo sent", { tone: "running" });
      const created = yield* client("createTodo", { title });
      calls.add(`createTodo: todo ${created.id}`, { tone: "success" });
      calls.add(`getTodo sent with id ${created.id}`, { tone: "running" });
      const todo = yield* client("getTodo", { id: created.id });
      calls.add(`getTodo: "${todo.title}"`, { tone: "success" });
      return todo;
    })
  );
</script>

<script lang="ts">
  import { Cause, Option } from "effect";
  import { useAtomSet, useAtomValue } from "effect-atom-svelte";
  import EventLog from "#lib/docs/kit/event-log.svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  const result = useAtomValue(createAndReadAtom);
  const createAndRead = useAtomSet(createAndReadAtom);

  let title = $state("Feed the cat");

  // A failed call ends the effect, so the calls after it are never sent.
  const describe = (cause: Cause.Cause<{ readonly _tag: string }>) =>
    Option.match(Cause.findErrorOption(cause), {
      onNone: () => "Something went wrong.",
      onSome: (error) => `${error._tag}: the effect stopped there`,
    });

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    calls.clear();
    createAndRead(title);
  };
</script>

<form class="flex flex-wrap items-center gap-2" onsubmit={submit}>
  <input aria-label="Title" bind:value={title} data-testid="create-read-title" />
  <button data-cue="start" disabled={result.current.waiting}>Create and read</button>
  <button onclick={() => (title = "x".repeat(70))} type="button">
    Paste a long title
  </button>
</form>
<div class="mt-3 flex flex-wrap items-center gap-3">
  {#if result.current._tag === "Success"}
    {@const todo = result.current.value}
    <ResultChip kind="message" label="createAndReadAtom" tone="success">
      <span data-testid="create-read">Todo {todo.id}: {todo.title}</span>
    </ResultChip>
  {:else if result.current._tag === "Failure"}
    <ResultChip kind="message" label="createAndReadAtom" tone="failure">
      <span data-testid="create-read">{describe(result.current.cause)}</span>
    </ResultChip>
  {/if}
  <StateBadge data-testid="create-read-state" result={result.current} />
</div>
<EventLog
  data-testid="create-read-log"
  empty="Click Create and read."
  entries={calls.entries}
  label="Calls"
/>
