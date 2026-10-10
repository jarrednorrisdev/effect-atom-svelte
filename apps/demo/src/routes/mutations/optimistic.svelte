<script module lang="ts">
  import { Data, Effect } from "effect";
  import { AsyncResult, Atom } from "effect/reactivity";

  import { toggleTodo } from "./api.ts";
  import { runtime, todosAtom } from "./todos.ts";

  class ConnectionLost extends Data.TaggedError("ConnectionLost") {}

  // Turned on by "Make the next save fail"; the next save turns it off.
  const failNextAtom = Atom.make(false);

  // Toggles a todo on a slow connection: 1.5 seconds. When failNextAtom is
  // on, it fails instead, as a dropped connection would, and the server
  // never hears of it.
  const toggleAtom = runtime.fn((id: number, get) =>
    Effect.gen(function* save() {
      yield* Effect.sleep("1500 millis");
      if (get(failNextAtom)) {
        get.set(failNextAtom, false);
        return yield* new ConnectionLost();
      }
      return yield* toggleTodo(id);
    })
  );

  // Shows the todo toggled while toggleAtom runs. On success it refreshes
  // todosAtom, so toggleAtom needs no reactivityKeys; on failure it goes back
  // to what it was.
  const optimisticTodosAtom = Atom.optimistic(todosAtom);
  const toggleOptimisticAtom = optimisticTodosAtom.pipe(
    Atom.optimisticFn({
      fn: toggleAtom,
      reducer: (current, id: number) =>
        current.pipe(
          AsyncResult.map((todos) =>
            todos.map((todo) =>
              todo.id === id ? { ...todo, done: !todo.done } : todo
            )
          )
        ),
    })
  );
</script>

<script lang="ts">
  import { useAtom, useAtomSet, useAtomValue } from "effect-atom-svelte";
  import CauseView from "#lib/docs/kit/cause-view.svelte";
  import Part from "#lib/docs/kit/part.svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  // What the page shows, with the provisional change applied while a save runs,
  // and what the server has.
  const onScreen = useAtomValue(optimisticTodosAtom);
  const onServer = useAtomValue(todosAtom);
  const saving = useAtomValue(toggleOptimisticAtom);
  const toggle = useAtomSet(toggleOptimisticAtom);
  const failNext = useAtom(failNextAtom);

  // A todo whose screen state differs from the server's is provisional.
  const serverDone = $derived(
    new Map(
      onServer.current._tag === "Success"
        ? onServer.current.value.map((todo) => [todo.id, todo.done])
        : []
    )
  );
</script>

<p class="flex flex-wrap items-center gap-3">
  <button
    aria-pressed={failNext.current}
    onclick={() => (failNext.current = !failNext.current)}
  >
    Make the next save fail
  </button>
  {#if saving.current.waiting}
    <ResultChip duration={1500} kind="message" tone="running">
      Saving…
    </ResultChip>
  {/if}
  <StateBadge data-testid="optimistic-state" result={saving.current} />
</p>
<div class="grid gap-3 sm:grid-cols-2">
  <Part code label="On screen: optimisticTodosAtom" top>
    {#if onScreen.current._tag === "Success"}
      <ul class="m-0 grid list-none gap-1 p-0" data-testid="optimistic-todos">
        {#each onScreen.current.value as todo (todo.id)}
          <li class="m-0 flex items-center justify-between gap-2">
            <label>
              <!-- One save at a time: a new call would interrupt the one in flight. -->
              <input
                checked={todo.done}
                disabled={saving.current.waiting}
                onchange={() => toggle(todo.id)}
                type="checkbox"
              />
              {todo.title}
            </label>
            {#if serverDone.get(todo.id) !== todo.done}
              <span class="text-xs text-muted-foreground">provisional</span>
            {/if}
          </li>
        {/each}
      </ul>
    {:else}
      <p class="m-0">Loading the todos…</p>
    {/if}
  </Part>
  <Part code label="On the server: todosAtom" top>
    {#if onServer.current._tag === "Success"}
      <ul class="m-0 grid list-none gap-1 p-0" data-testid="server-todos">
        {#each onServer.current.value as todo (todo.id)}
          <li class="m-0">{todo.done ? "✓" : "○"} {todo.title}</li>
        {/each}
      </ul>
    {:else}
      <p class="m-0">Loading the todos…</p>
    {/if}
  </Part>
</div>
{#if saving.current._tag === "Failure"}
  <CauseView
    cause={saving.current.cause}
    code
    data-testid="optimistic-error"
    label="toggleOptimisticAtom: the save failed, so the todo went back"
  />
{/if}
