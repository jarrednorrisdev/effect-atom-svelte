<!-- Reads a seeded useAtomSuspense once in the script, outside any reaction, and again in markup. -->
<script lang="ts">
  import { useAtom, useAtomSuspense } from "../../src/index.ts";
  import { filterAtom, listFor } from "./seeded-list.ts";

  const filter = useAtom(filterAtom);
  const list = useAtomSuspense(() => listFor(filter.current));
  const first = await list.current;
</script>

<button onclick={() => (filter.current = "b")}>b</button>
<p>{first}</p>
<span>{filter.current}</span>
<output>{await list.current}</output>
