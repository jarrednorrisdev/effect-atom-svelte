<script module lang="ts">
  import { Todo } from "@demo/domain";
  import { Data, Effect } from "effect";
  import { AsyncResult, Atom } from "effect/reactivity";

  import { TodosRpc } from "#lib/clients.ts";

  class ConnectionLost extends Data.TaggedError("ConnectionLost") {}

  const todosAtom = TodosRpc.query("listTodos", undefined, {
    reactivityKeys: ["todos"],
  });

  // Ticked by "Make the next save fail"; the next save unticks it.
  const failNextAtom = Atom.make(false);

  // Toggles a todo over RPC. When failNextAtom is ticked, it fails after a second
  // instead, as a dropped connection would, and the server never hears of it.
  const toggleAtom = TodosRpc.runtime.fn(
    (id: number, get) =>
      Effect.gen(function* toggleTodo() {
        if (get(failNextAtom)) {
          get.set(failNextAtom, false);
          yield* Effect.sleep("1 second");
          return yield* new ConnectionLost();
        }
        const client = yield* TodosRpc;
        return yield* client("toggleTodo", { id });
      }),
    { reactivityKeys: ["todos"] }
  );

  // Shows the todo toggled while toggleAtom runs. On success the list is read
  // again; on failure it goes back to what it was.
  const optimisticTodosAtom = Atom.optimistic(todosAtom);
  const toggleOptimisticAtom = optimisticTodosAtom.pipe(
    Atom.optimisticFn({
      fn: toggleAtom,
      reducer: (current, id: number) =>
        current.pipe(
          AsyncResult.map((todos) =>
            todos.map((todo) =>
              todo.id === id ? new Todo({ ...todo, done: !todo.done }) : todo
            )
          )
        ),
    })
  );
</script>

<script lang="ts">
  import { Option } from "effect";
  import { useAtom, useAtomSet, useAtomValue } from "effect-atom-svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  const todos = useAtomValue(optimisticTodosAtom);
  const saving = useAtomValue(toggleOptimisticAtom);
  const toggle = useAtomSet(toggleOptimisticAtom);
  const failNext = useAtom(failNextAtom);

  // The typed error of the last save, if it failed.
  const error = $derived(Option.getOrUndefined(AsyncResult.error(saving.current)));
</script>

<p class="flex flex-wrap items-center gap-3">
  <label>
    <input bind:checked={failNext.current} type="checkbox" /> Make the next save fail
  </label>
  <StateBadge data-testid="optimistic-state" result={saving.current} />
</p>
{#if todos.current._tag === "Success"}
  <ul aria-busy={todos.current.waiting} data-testid="optimistic-todos">
    {#each todos.current.value as todo (todo.id)}
      <li>
        <label>
          <input checked={todo.done} onchange={() => toggle(todo.id)} type="checkbox" />
          {todo.title}
        </label>
      </li>
    {/each}
  </ul>
{:else}
  <p>Loading the todos…</p>
{/if}
{#if error}
  <ResultChip kind="message" label="toggleOptimisticAtom" tone="failure">
    <span data-testid="optimistic-error">
      {error._tag}: the save failed, so the todo went back.
    </span>
  </ResultChip>
{/if}
