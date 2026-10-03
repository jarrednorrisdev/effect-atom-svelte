<script lang="ts">
  import { useAtom } from "effect-atom-svelte";

  import { Counter } from "./counter-scope.ts";

  const count = useAtom(Counter.use());
</script>

<button onclick={() => (count.current += 1)}>{count.current}</button>
