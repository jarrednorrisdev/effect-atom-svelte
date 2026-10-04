<script lang="ts">
  import TodoRow from "./todo-row.svelte";

  interface Props {
    /** The id of the todo the details panel shows. */
    selected: number;
    readonly todos: readonly { readonly id: number; readonly title: string }[];
  }

  let { selected = $bindable(), todos }: Props = $props();
</script>

<ul aria-label="Todos" class="m-0 flex list-none flex-col gap-1 p-0">
  {#each todos as todo (todo.id)}
    <TodoRow
      id={todo.id}
      onselect={() => (selected = todo.id)}
      selected={selected === todo.id}
      title={todo.title}
    />
  {/each}
</ul>
