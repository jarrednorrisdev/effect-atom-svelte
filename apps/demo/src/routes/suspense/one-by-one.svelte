<script lang="ts">
  import { useAtomResult } from "effect-atom-svelte";

  import LoadResults from "./load-results.svelte";
  import { oneByOne } from "./slow-pairs.ts";

  const started = performance.now();
  // The second effect starts only once the first has a result.
  const todos = await useAtomResult(oneByOne.todosAtom);
  const user = await useAtomResult(oneByOne.userAtom);
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
</script>

<LoadResults
  results={{ todos: todos.current, user: user.current }}
  {seconds}
  testid="one-by-one"
/>
