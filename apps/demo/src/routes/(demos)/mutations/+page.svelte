<script module lang="ts">
  import type { Todo } from "@demo/domain";
  import { Effect } from "effect";
  import { AsyncResult, Atom } from "effect/reactivity";

  import { TodosRpc } from "#lib/clients.ts";

  const echoAtom = Atom.fn((message: string) =>
    Effect.succeed(message.toUpperCase()).pipe(Effect.delay("1 second"))
  );

  const listAtom = Atom.optimistic(
    TodosRpc.query("listTodos", undefined, { reactivityKeys: ["todos"] })
  );
  const addOptimisticAtom = listAtom.pipe(
    Atom.optimisticFn({
      fn: TodosRpc.runtime.fn((title: string) =>
        Effect.gen(function* createTodo() {
          const client = yield* TodosRpc;
          return yield* client("createTodo", { title });
        })
      ),
      reducer: (current, title: string) =>
        AsyncResult.map((todos: readonly Todo[]) => [
          ...todos,
          { done: false, id: -1, title } as Todo,
        ])(current),
    })
  );
</script>

<script lang="ts">
  import { useAtomSet, useAtomValue } from "effect-atom-svelte";

  const echo = useAtomValue(echoAtom);
  const runEcho = useAtomSet(echoAtom, { mode: "promise" });
  const setEcho = useAtomSet(echoAtom);
  const list = useAtomValue(listAtom);
  const addOptimistic = useAtomSet(addOptimisticAtom);
  let resolved = $state<string[]>([]);
  let title = $state("Optimistic todo");

  const fire = async (message: string) => {
    const result = await runEcho(message);
    resolved = [...resolved, `${message} → ${result}`];
  };
</script>

<h1>Mutations</h1>

<section>
  <h2>Atom.fn and promise mode</h2>
  <p>
    Each call takes a second. Firing again interrupts the call in flight; both promises resolve with
    the latest result, because promise mode waits for the atom's next settled value.
  </p>
  <button onclick={() => fire("first")}>Echo "first"</button>
  <button onclick={() => fire("second")}>Echo "second"</button>
  <button onclick={() => setEcho(Atom.Reset)}>Reset</button>
  <p>
    State: <output data-testid="echo-state">{echo.current._tag}{echo.current.waiting ? " (waiting)" : ""}</output>
  </p>
  <ul>
    {#each resolved as line, index (index)}<li>{line}</li>{/each}
  </ul>
</section>

<section>
  <h2>Optimistic updates</h2>
  <p>
    <code>Atom.optimisticFn</code> adds the todo to the list straight away. The server takes 400ms;
    when it confirms, the list refetches and the placeholder (id −1) is replaced by the real todo.
  </p>
  <input bind:value={title} />
  <button onclick={() => addOptimistic(title)}>Add optimistically</button>
  {#if list.current._tag === "Success"}
    <ul data-testid="optimistic-list">
      {#each list.current.value as item (item.id)}
        <li style:opacity={item.id === -1 ? 0.5 : 1}>{item.title} <small>#{item.id}</small></li>
      {/each}
    </ul>
  {/if}
</section>
