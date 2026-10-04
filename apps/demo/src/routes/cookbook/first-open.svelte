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
  import ResultChip from "#lib/docs/kit/result-chip.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  const firstOpen = useAtomValue(firstOpenAtom);
  const toggling = useAtomValue(toggleAtom);
  const toggle = useAtomSet(toggleAtom);
</script>

<div class="flex flex-wrap items-baseline gap-4">
  {#if firstOpen.current._tag === "Success"}
    {@const todo = firstOpen.current.value}
    <ResultChip
      busy={firstOpen.current.waiting}
      kind="message"
      label="firstOpenAtom"
      tone="success"
    >
      <span data-testid="first-open">
        {todo ? `Next up: ${todo.title}` : "Nothing left to do."}
      </span>
    </ResultChip>
    {#if todo}
      <button
        disabled={toggling.current.waiting || firstOpen.current.waiting}
        onclick={() =>
          toggle({ payload: { id: todo.id }, reactivityKeys: ["todos"] })}
      >
        Done
      </button>
    {/if}
  {:else if firstOpen.current._tag === "Failure"}
    <ResultChip kind="message" label="firstOpenAtom" tone="failure">
      Could not load the todos.
    </ResultChip>
  {:else}
    <ResultChip kind="message" label="firstOpenAtom" tone="running">
      Loading…
    </ResultChip>
  {/if}
  <StateBadge data-testid="first-open-state" result={firstOpen.current} />
</div>
