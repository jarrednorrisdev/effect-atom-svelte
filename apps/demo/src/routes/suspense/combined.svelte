<script module lang="ts">
  import { Effect } from "effect";
  import { Atom } from "effect/reactivity";

  import { combined } from "./slow-pairs.ts";

  // One atom runs both loads. Effect.all runs effects one after another unless
  // it is given a concurrency.
  const dashboardAtom = Atom.make(
    Effect.all([combined.loadTodos, combined.loadUser], {
      concurrency: "unbounded",
    })
  );
</script>

<script lang="ts">
  import { useAtomResult } from "effect-atom-svelte";

  import LoadResults from "./load-results.svelte";

  const started = performance.now();
  // One atom, so the script awaits once.
  const dashboard = await useAtomResult(dashboardAtom);
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
</script>

<LoadResults
  results={{ dashboard: dashboard.current }}
  {seconds}
  testid="combined"
/>
