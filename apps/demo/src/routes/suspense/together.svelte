<script lang="ts">
  import { useAtomResult } from "effect-atom-svelte";

  import LoadResults from "./load-results.svelte";
  import { together } from "./slow-pairs.ts";

  const started = performance.now();
  // Both effects start at once.
  const [todos, user] = await Promise.all([
    useAtomResult(together.todosAtom),
    useAtomResult(together.userAtom),
  ]);
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
</script>

<LoadResults
  results={{ todos: todos.current, user: user.current }}
  {seconds}
  testid="together"
/>
