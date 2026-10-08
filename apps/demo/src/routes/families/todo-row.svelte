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

<li class={["m-0 flex items-center gap-2 rounded-md px-2", selected && "bg-brand/15"]}>
  <input
    aria-label="{title} done"
    checked={todo.current.done}
    onchange={(event) => (todo.current = { ...todo.current, done: event.currentTarget.checked })}
    type="checkbox"
  />
  <button
    aria-current={selected ? "true" : undefined}
    class={[
      "m-0! flex-1 border-0! bg-transparent! p-0! text-left",
      todo.current.done && "text-muted-foreground! line-through",
    ]}
    onclick={onselect}
    type="button"
  >
    {title}
  </button>
</li>
