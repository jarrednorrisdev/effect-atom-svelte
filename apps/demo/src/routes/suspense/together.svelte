<script lang="ts">
  import { useAtomResult } from "effect-atom-svelte";

  import { together } from "./slow-pairs.ts";

  const started = performance.now();
  // Both effects start at once.
  const [todos, user] = await Promise.all([
    useAtomResult(together.todosAtom),
    useAtomResult(together.userAtom),
  ]);
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
</script>

<p class="m-0">
  Ready after <output data-testid="together">{seconds} s</output>
  ({todos.current._tag}, {user.current._tag})
</p>
