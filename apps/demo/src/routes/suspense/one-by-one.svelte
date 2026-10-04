<script lang="ts">
  import { useAtomResult } from "effect-atom-svelte";

  import { oneByOne } from "./slow-pairs.ts";

  const started = performance.now();
  // The second effect starts only once the first has a result.
  const todos = await useAtomResult(oneByOne.todosAtom);
  const user = await useAtomResult(oneByOne.userAtom);
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
</script>

<p class="m-0">
  Ready after <output data-testid="one-by-one">{seconds} s</output>
  ({todos.current._tag}, {user.current._tag})
</p>
