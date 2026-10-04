<script lang="ts">
  import TodoCard from "./todo-card.svelte";

  // No load function, and no data passed down: each card awaits its own atom.
  let other = $state(2);
  const next = () => (other = (other % 4) + 1);
</script>

<p><button onclick={next}>Show another todo</button></p>
<div class="grid gap-3 sm:grid-cols-2">
  <TodoCard id={1} />
  <TodoCard id={other} />
</div>
