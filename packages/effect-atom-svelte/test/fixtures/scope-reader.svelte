<!-- Reads totalAtom and writes countAtom, named as the atomLabels plugin would name it. -->
<script lang="ts">
  import { nameComponent } from "../../src/Inspector.ts";
  import { useAtomSet, useAtomValue } from "../../src/index.ts";
  import { countAtom, totalAtom } from "./scope-atoms.ts";

  nameComponent("ScopeReader", "/test/fixtures/scope-reader.svelte");
  const total = useAtomValue(totalAtom);
  const setCount = useAtomSet(countAtom);
</script>

<output>{total.current}</output>
<button onclick={() => setCount((count) => count + 1)} type="button">add</button>
