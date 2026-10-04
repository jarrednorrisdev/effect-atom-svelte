<script lang="ts">
  import { useAtom, useAtomValue } from "effect-atom-svelte";

  import { countAtom, doubledAtom } from "./counter.ts";

  const count = useAtom(countAtom);
  const doubled = useAtomValue(doubledAtom);
</script>

<button onclick={() => (count.current += 1)}>Count: {count.current}</button>
<p>Doubled: {doubled.current}</p>
