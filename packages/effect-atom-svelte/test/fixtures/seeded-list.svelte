<script lang="ts">
  import { useAtom, useAtomSuspense } from "../../src/index.ts";
  import { filterAtom, listFor } from "./seeded-list.ts";

  const filter = useAtom(filterAtom);
  const list = useAtomSuspense(() => listFor(filter.current));
</script>

<button onclick={() => (filter.current = "b")}>b</button>
<output>{await list.current}</output>
