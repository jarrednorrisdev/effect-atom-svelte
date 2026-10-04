<script lang="ts">
  import { useAtom } from "effect-atom-svelte";
  import FlashValue from "#lib/docs/kit/flash-value.svelte";

  import { todoAtom } from "./todos.ts";

  interface Props {
    readonly id: number;
    readonly title: string;
  }

  const { id, title }: Props = $props();

  // Follows whichever todo is open: a new id reads that todo's atom.
  const todo = useAtom(() => todoAtom(id));
</script>

<h3 class="m-0 text-base" data-testid="details-title">{title}</h3>
<p class="mt-1 mb-3 text-sm text-muted-foreground">
  Reading <code>todoAtom({id})</code>
</p>
<p class="m-0">
  <button
    aria-pressed={todo.current.done}
    onclick={() => (todo.current = { ...todo.current, done: !todo.current.done })}
  >
    Done
  </button>
  <FlashValue data-testid="details-status" value={todo.current.done ? "done" : "open"} />
</p>
