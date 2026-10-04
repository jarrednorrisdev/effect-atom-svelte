<script lang="ts">
  import Part from "#lib/docs/kit/part.svelte";

  import TodoDetails from "./todo-details.svelte";
  import TodoList from "./todo-list.svelte";

  // A tiny app: a list and a details panel. They share no state of their own; each calls
  // todoAtom with an id.
  let todos = $state([
    { id: 1, title: "Buy milk" },
    { id: 2, title: "Walk the dog" },
    { id: 3, title: "Write the report" },
  ]);
  let selected = $state(1);
  let draft = $state("");

  const open = $derived(todos.find((todo) => todo.id === selected));

  const add = (event: SubmitEvent) => {
    event.preventDefault();
    const title = draft.trim() || `Todo ${todos.length + 1}`;
    const id = Math.max(...todos.map((todo) => todo.id)) + 1;
    // A new id: the family has never seen it, so its first call makes the atom.
    todos.push({ id, title });
    selected = id;
    draft = "";
  };
</script>

<div class="grid gap-3 sm:grid-cols-[3fr_2fr]">
  <Part code label="todo-list.svelte">
    <TodoList bind:selected {todos} />
    <form class="mt-3 flex" onsubmit={add}>
      <input aria-label="New todo" bind:value={draft} class="min-w-0 flex-1" placeholder="New todo" />
      <button>Add</button>
    </form>
  </Part>
  <Part code label="todo-details.svelte">
    {#if open}<TodoDetails id={open.id} title={open.title} />{/if}
  </Part>
</div>
