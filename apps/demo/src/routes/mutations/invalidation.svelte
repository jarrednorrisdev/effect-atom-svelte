<!--
  Beside the add-todo example: how one createTodo reaches the list. The mutation
  runs, succeeds and invalidates "todos"; todosAtom, tagged with that key, runs
  again and brings the new todo.
  Presentation only; it reads the example's atoms.
-->
<script lang="ts">
  import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
  import type { AsyncResult } from "effect/reactivity";
  import { useAtomValue } from "effect-atom-svelte";
  import { untrack } from "svelte";
  import EventLog from "#lib/docs/kit/event-log.svelte";
  import { EventLogState } from "#lib/docs/kit/event-log.svelte.ts";
  import Part from "#lib/docs/kit/part.svelte";
  import { toneOf } from "#lib/docs/kit/tone.ts";
  import type { Tone } from "#lib/docs/kit/tone.ts";

  import { createAtom, todosAtom } from "./add-todo.svelte";

  const creating = useAtomValue(createAtom);
  const todos = useAtomValue(todosAtom);

  // Running while a call is in flight, even when an earlier value is kept.
  const live = (result: AsyncResult.AsyncResult<unknown, unknown>): Tone =>
    result.waiting ? "running" : toneOf(result);

  const log = new EventLogState({ limit: 12 });
  let invalidations = $state(0);
  let keyTone = $state<Tone>("idle");

  // Logs each change of state of the mutation and the query, in the order they happen.
  interface Seen {
    readonly create: string;
    readonly list: string;
  }
  let before: Seen | undefined;
  const describe = (result: AsyncResult.AsyncResult<unknown, unknown>) =>
    `${result._tag}${result.waiting ? " waiting" : ""}`;

  const record = (now: Seen, was: Seen) => {
    if (now.create !== was.create) {
      if (creating.current.waiting) {
        log.clear();
        keyTone = "idle";
        log.add("createTodo sent", { tone: "running" });
      } else if (creating.current._tag === "Success") {
        invalidations += 1;
        keyTone = "success";
        log.add('createTodo succeeded: "todos" invalidated', { tone: "success" });
      } else if (creating.current._tag === "Failure") {
        keyTone = "idle";
        log.add("createTodo failed: nothing invalidated", { tone: "failure" });
      }
    }
    if (now.list !== was.list) {
      if (todos.current.waiting) {
        log.add("listTodos runs again", { tone: "running" });
      } else if (todos.current._tag === "Success") {
        log.add(`listTodos: ${todos.current.value.length} todos`, { tone: "success" });
      }
    }
  };

  $effect(() => {
    const now = { create: describe(creating.current), list: describe(todos.current) };
    const was = before;
    before = now;
    if (was) {
      untrack(() => record(now, was));
    }
  });

  const count = $derived(
    todos.current._tag === "Success" ? todos.current.value.length : 0
  );
</script>

<div class="mt-4 grid gap-3" data-testid="invalidation">
  <div class="flex flex-col gap-2 sm:flex-row">
    <Part data-testid="part-create" label="createAtom" tone={live(creating.current)}>
      <code>createTodo</code>
    </Part>
    <ArrowRightIcon
      aria-hidden="true"
      class="rotate-90 self-center text-muted-foreground sm:rotate-0"
    />
    <Part
      count={invalidations}
      countLabel="invalidated"
      data-testid="part-key"
      label="key"
      tone={keyTone}
    >
      <code>"todos"</code>
    </Part>
    <ArrowRightIcon
      aria-hidden="true"
      class="rotate-90 self-center text-muted-foreground sm:rotate-0"
    />
    <Part
      count={count}
      countLabel="todos"
      data-testid="part-list"
      label="todosAtom"
      tone={live(todos.current)}
    >
      <code>listTodos</code>
    </Part>
  </div>
  <EventLog
    data-testid="invalidation-log"
    empty="Add a todo to see the request travel."
    entries={log.entries}
    label="createTodo, then the list"
    max={6}
  />
</div>
