<script module lang="ts">
  import { Atom, AsyncResult } from "effect/reactivity";

  import { TodosRpc } from "#lib/clients.ts";

  // Tagged "todos": it fetches again when a mutation with that key succeeds.
  const todosAtom = TodosRpc.query("listTodos", undefined, {
    reactivityKeys: ["todos"],
    serializationKey: "home-todos",
  });
  // How many todos aren't done yet. Derived from the list, so it follows along.
  const openCountAtom = todosAtom.pipe(
    Atom.map(AsyncResult.map((todos) => todos.filter((todo) => !todo.done).length))
  );
  const createAtom = TodosRpc.mutation("createTodo");
  const toggleAtom = TodosRpc.mutation("toggleTodo");
</script>

<script lang="ts">
  import { Option } from "effect";
  import { useAtomResult, useAtomSet, useAtomValue } from "effect-atom-svelte";
  import FlashValue from "#lib/docs/kit/flash-value.svelte";
  import Part from "#lib/docs/kit/part.svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";
  import { RequestCount } from "#lib/docs/kit/requests.svelte.ts";

  // Declared before the await, so text typed before hydration is kept.
  let title = $state("Feed the cat");

  // Server rendering waits for the list, and sends it with the page.
  const todos = await useAtomResult(todosAtom);
  const openCount = useAtomValue(openCountAtom);
  const creating = useAtomValue(createAtom);
  const create = useAtomSet(createAtom);
  const toggling = useAtomValue(toggleAtom);
  const toggle = useAtomSet(toggleAtom);
  // The typed error, if createTodo failed with one.
  const createError = $derived(AsyncResult.error(creating.current));
  // Anything in flight: a mutation, or the refetch it starts.
  const busy = $derived(
    creating.current.waiting || toggling.current.waiting || todos.current.waiting
  );
  // For the counter: each time the list is fetched from the browser.
  const requests = new RequestCount(() => todosAtom);

  // No refresh to call: invalidating "todos" makes todosAtom fetch again.
  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    create({ payload: { title }, reactivityKeys: ["todos"] });
  };
</script>

<form class="flex flex-wrap" onsubmit={submit}>
  <input aria-label="New todo" bind:value={title} class="min-w-0 flex-1" data-testid="home-draft" />
  <button disabled={creating.current.waiting}>
    {creating.current.waiting ? "Adding…" : "Add"}
  </button>
</form>
{#if creating.current._tag === "Failure"}
  <div class="mt-3">
    <ResultChip kind="message" tone="failure">
      {Option.isSome(createError) && createError.value._tag === "TitleTooLong"
        ? `Titles can be ${createError.value.maxLength} characters at most`
        : "Couldn't reach the server"}
    </ResultChip>
  </div>
{/if}
<div class="mt-3 grid gap-3 sm:grid-cols-[3fr_2fr]">
  <Part
    code
    count={requests.current}
    countLabel="fetches"
    label="todosAtom"
    tone={busy ? "running" : "idle"}
  >
    {#if todos.current._tag === "Success"}
      <ul aria-busy={todos.current.waiting} class="m-0 grid gap-1" data-testid="home-todos">
        {#each todos.current.value.slice(-5) as todo (todo.id)}
          <li class="truncate">
            <label>
              <!-- One toggle at a time: a second would cancel waiting for the first. -->
              <input
                checked={todo.done}
                disabled={toggling.current.waiting}
                onchange={() => toggle({ payload: { id: todo.id }, reactivityKeys: ["todos"] })}
                type="checkbox"
              />
              {todo.title}
            </label>
          </li>
        {/each}
      </ul>
    {:else if todos.current._tag === "Failure"}
      <ResultChip kind="message" tone="failure">Couldn't reach the server</ResultChip>
    {/if}
  </Part>
  <Part code label="openCountAtom">
    <FlashValue
      big
      data-testid="home-open"
      value={AsyncResult.getOrElse(openCount.current, () => 0)}
    />
    <p class="mt-2 mb-0 text-sm text-muted-foreground">todos not done yet</p>
  </Part>
</div>
