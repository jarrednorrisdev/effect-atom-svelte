<script lang="ts">
  import { useAtom } from "effect-atom-svelte";

  import { todoAtom } from "./todos.ts";

  interface Props {
    readonly id: number;
    readonly onselect: () => void;
    readonly selected: boolean;
    readonly title: string;
  }

  const { id, onselect, selected, title }: Props = $props();

  // This row's todo. The details panel calls todoAtom with the same id, so it gets this atom.
  const todo = useAtom(() => todoAtom(id));
</script>

<li class={["row m-0", selected && "selected"]}>
  <input
    aria-label="{title} done"
    checked={todo.current.done}
    onchange={(event) => (todo.current = { ...todo.current, done: event.currentTarget.checked })}
    type="checkbox"
  />
  <button
    aria-current={selected ? "true" : undefined}
    class={["open", todo.current.done && "done"]}
    onclick={onselect}
    type="button"
  >
    {title}
  </button>
</li>

<style>
  .row {
    align-items: center;
    border-radius: var(--radius-md);
    display: flex;
    gap: 0.5rem;
    padding: 0 0.5rem;
  }
  .selected {
    background: color-mix(in oklab, var(--brand) 15%, transparent);
  }
  /* The title opens the todo: a row, not a button, so drop the example's button look. */
  .open,
  .open:hover {
    background: transparent;
    border: 0;
    flex: 1;
    padding: 0;
    text-align: left;
  }
  .done {
    color: var(--muted-foreground);
    text-decoration: line-through;
  }
</style>
