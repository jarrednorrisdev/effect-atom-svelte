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
  import FlashValue from "#lib/docs/kit/flash-value.svelte";
  import ResultHistory from "#lib/docs/kit/result-history.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  const polled = useAtomValue(polledTodosAtom);
</script>

<div class="flex flex-wrap items-center gap-3">
  {#if polled.current._tag === "Success"}
    <p data-testid="polled">
      {polled.current.value.length} todos, checked at
      <FlashValue
        value={new Date(polled.current.timestamp).toLocaleTimeString()}
      />
    </p>
  {:else if polled.current._tag === "Failure"}
    <p>Could not check the todos.</p>
  {:else}
    <p aria-busy="true">Checking…</p>
  {/if}
  <StateBadge data-testid="polled-state" result={polled.current} sound={false} />
</div>
<ResultHistory
  data-testid="polled-history"
  format={(todos) => (Array.isArray(todos) ? `${todos.length} todos` : "")}
  label="Checks"
  result={polled.current}
/>
