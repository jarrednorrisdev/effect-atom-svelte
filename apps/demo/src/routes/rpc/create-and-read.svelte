<script module lang="ts">
  import { Effect } from "effect";
  import { EventLogState } from "#lib/docs/kit/event-log.svelte.ts";

  import { TodosRpc } from "#lib/clients.ts";

  // Each call the effect makes, for the log under the example.
  const calls = new EventLogState();

  // Logs a call's failure, which ends the effect.
  const logFailure =
    (name: string) =>
    <A, E extends { readonly _tag: string }, R>(call: Effect.Effect<A, E, R>) =>
      Effect.tapError(call, (failure) =>
        Effect.sync(() => calls.add(`${name} failed: ${failure._tag}`, { tone: "failure" }))
      );

  // Two calls in one effect: getTodo needs the id that createTodo returns.
  const createAndReadAtom = TodosRpc.runtime.fn((title: string) =>
    Effect.gen(function* createThenRead() {
      const client = yield* TodosRpc;
      calls.add("createTodo sent", { tone: "running" });
      const created = yield* client("createTodo", { title }).pipe(
        logFailure("createTodo")
      );
      calls.add(`createTodo: todo ${created.id}`, { tone: "success" });
      calls.add(`getTodo sent with id ${created.id}`, { tone: "running" });
      const todo = yield* client("getTodo", { id: created.id }).pipe(
        logFailure("getTodo")
      );
      calls.add(`getTodo: "${todo.title}"`, { tone: "success" });
      return todo;
    })
  );
</script>

<script lang="ts">
  import { useAtomSet, useAtomValue } from "effect-atom-svelte";
  import CauseView from "#lib/docs/kit/cause-view.svelte";
  import EffectType from "#lib/docs/kit/effect-type.svelte";
  import EventLog from "#lib/docs/kit/event-log.svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  const result = useAtomValue(createAndReadAtom);
  const createAndRead = useAtomSet(createAndReadAtom);

  let title = $state("Feed the cat");

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
<!-- The error type is both procedures' errors, plus RpcClientError. -->
<p class="flex flex-wrap items-center gap-3">
  <EffectType
    error={["TitleTooLong", "TodoNotFound", "RpcClientError"]}
    name="createAndReadAtom"
    result={result.current}
    success="Todo"
  />
  <StateBadge data-testid="create-read-state" result={result.current} />
</p>
{#if result.current._tag === "Success"}
  {@const todo = result.current.value}
  <ResultChip kind="message" label="createAndReadAtom" tone="success">
    <span data-testid="create-read">Todo {todo.id}: {todo.title}</span>
  </ResultChip>
{:else if result.current._tag === "Failure"}
  <!-- The first failure ends the effect, so the calls after it are never sent. -->
  <CauseView cause={result.current.cause} data-testid="create-read" />
{/if}
<EventLog
  data-testid="create-read-log"
  empty="Click Create and read."
  entries={calls.entries}
  label="Calls"
/>
