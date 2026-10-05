<script module lang="ts">
  import { TodosHttp } from "#lib/clients.ts";

  type Filter = "all" | "true" | "false";

  // GET /api/todos?done=…: a query, and a serialization key, per filter.
  const todosFor = (filter: Filter) =>
    TodosHttp.query("todos", "list", {
      query: filter === "all" ? {} : { done: filter },
      reactivityKeys: ["todos"],
      serializationKey: `http-todos-${filter}`,
    });
</script>

<script lang="ts">
  import { useAtomSuspense } from "effect-atom-svelte";
  import Part from "#lib/docs/kit/part.svelte";
  import { RequestCount } from "#lib/docs/kit/requests.svelte.ts";

  const filters = [
    { label: "All", value: "all" },
    { label: "Open", value: "false" },
    { label: "Done", value: "true" },
  ] as const;
  let filter = $state<Filter>("all");

  // The getter follows the filter: each one is its own query atom.
  const todos = useAtomSuspense(() => todosFor(filter));
  // For the counter: each request a list query makes from the browser.
  const requests = new RequestCount(() => todosFor(filter));
</script>

<Part code count={requests.current} countLabel="requests" label="query todos.list">
  <div aria-label="Filter" class="flex flex-wrap gap-2" role="group">
    {#each filters as option (option.value)}
      <button
        aria-pressed={filter === option.value}
        onclick={() => (filter = option.value)}
      >
        {option.label}
      </button>
    {/each}
  </div>
  <code>GET /api/todos{filter === "all" ? "" : `?done=${filter}`}</code>

  <!-- No pending snippet, so server rendering waits for the list. -->
  <ul class="mt-2 grid gap-1" data-testid="http-todos">
    {#each await todos.current as todo (todo.id)}
      <li>{todo.done ? "✔" : "○"} {todo.title}</li>
    {/each}
  </ul>
</Part>
