<script lang="ts">
  import FlashValue from "#lib/docs/kit/flash-value.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  import { TodoForm } from "./todo-form.svelte.ts";

  const form = new TodoForm();
</script>

<form
  class="flex flex-wrap items-center gap-2"
  onsubmit={(event) => {
    event.preventDefault();
    void form.submit();
  }}
>
  <input
    aria-label="Title"
    bind:value={form.title}
    data-testid="class-title"
    placeholder="New todo"
    required
  />
  <button disabled={form.saving.current.waiting}>Save</button>
  <StateBadge data-testid="class-state" result={form.saving.current} />
</form>
{#if form.todos.current._tag === "Success"}
  <p>
    <FlashValue
      data-testid="class-count"
      value={form.todos.current.value.length}
    />
    todos on the server
  </p>
{/if}
