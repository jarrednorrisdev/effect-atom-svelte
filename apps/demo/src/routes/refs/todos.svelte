<script module lang="ts">
  import { AtomRef } from "effect/reactivity";

  // A list in which each item is its own ref.
  const todos = AtomRef.collection([
    { done: false, title: "Write the docs" },
    { done: true, title: "Fix the bug" },
  ]);
</script>

<script lang="ts">
  import { useAtomRef } from "effect-atom-svelte";
  import Part from "#lib/docs/kit/part.svelte";

  import TodoItem from "./todo-item.svelte";

  const list = useAtomRef(todos);
  const open = $derived(list.current.filter((item) => !item.value.done).length);

  // Counts the list's notifications: one for each item change, push or remove.
  let notified = $state(0);
  $effect(() => todos.subscribe(() => (notified += 1)));

  let title = $state("");
  const add = (event: SubmitEvent) => {
    event.preventDefault();
    todos.push({ done: false, title: title || "Something new" });
    title = "";
  };
</script>

<form class="mb-3" onsubmit={add}>
  <input aria-label="New todo" bind:value={title} placeholder="Something new" />
  <button>Add todo</button>
</form>
<Part code count={notified} countLabel="notifications" label="todos">
  <ul class="not-prose grid gap-1">
    {#each list.current as item (item.key)}
      <TodoItem {item} onremove={() => todos.remove(item)} />
    {/each}
  </ul>
  <p data-testid="todos-open">{open} of {list.current.length} open</p>
</Part>
