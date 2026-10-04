<script module lang="ts">
  import { Effect } from "effect";
  import { Atom } from "effect/reactivity";

  import { TodosRpc } from "#lib/clients.ts";

  import { todosAtom } from "./todos.ts";

  // Waits for the list, then fetches the first open todo by its id. It depends on
  // todosAtom, so it runs again whenever the list changes.
  const firstOpenAtom = Atom.make((get) =>
    Effect.gen(function* findFirstOpen() {
      const todos = yield* get.result(todosAtom);
      const open = todos.find((todo) => !todo.done);
      if (open === undefined) {
        return undefined;
      }
      return yield* get.result(TodosRpc.query("getTodo", { id: open.id }));
    })
  );
  const toggleAtom = TodosRpc.mutation("toggleTodo");
</script>

<script lang="ts">
  import { useAtomSet, useAtomValue } from "effect-atom-svelte";

  const firstOpen = useAtomValue(firstOpenAtom);
  const toggle = useAtomSet(toggleAtom);
</script>

{#if firstOpen.current._tag === "Success"}
  {@const todo = firstOpen.current.value}
  <p data-testid="first-open" style:opacity={firstOpen.current.waiting ? 0.5 : 1}>
    {#if todo}
      Next up: {todo.title}
      <button
        onclick={() =>
          toggle({ payload: { id: todo.id }, reactivityKeys: ["todos"] })}
      >
        Done
      </button>
    {:else}
      Nothing left to do.
    {/if}
  </p>
{:else if firstOpen.current._tag === "Failure"}
  <p>Could not load the todos.</p>
{:else}
  <p>Loading…</p>
{/if}
