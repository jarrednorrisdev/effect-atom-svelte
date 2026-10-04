<script module lang="ts">
  import { Atom } from "effect/reactivity";

  import { TodosRpc } from "#lib/clients.ts";

  // Changes every three seconds while something reads it.
  const everyThreeSeconds = Atom.readable((get) => {
    let ticks = 0;
    const interval = setInterval(() => get.setSelf((ticks += 1)), 3000);
    get.addFinalizer(() => clearInterval(interval));
    return ticks;
  });

  // Fetches the list again on every tick. withServerValueInitial keeps the timer off
  // the server, which would otherwise run it until the render ended.
  const polledTodosAtom = TodosRpc.query("listTodos", undefined).pipe(
    Atom.makeRefreshOnSignal(everyThreeSeconds),
    Atom.withServerValueInitial
  );
</script>

<script lang="ts">
  import { useAtomValue } from "effect-atom-svelte";

  const polled = useAtomValue(polledTodosAtom);
</script>

{#if polled.current._tag === "Success"}
  <p data-testid="polled">
    {polled.current.value.length} todos, checked at
    {new Date(polled.current.timestamp).toLocaleTimeString()}
  </p>
{:else}
  <p>Checking…</p>
{/if}
