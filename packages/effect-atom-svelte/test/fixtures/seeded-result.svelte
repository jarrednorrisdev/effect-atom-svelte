<script lang="ts">
  import { useAtom, useAtomResult } from "../../src/index.ts";
  import { filterAtom, listFor } from "./seeded-list.ts";

  const filter = useAtom(filterAtom);
  const list = await useAtomResult(() => listFor(filter.current));
</script>

<button onclick={() => (filter.current = "b")}>b</button>
<output>{list.current._tag === "Success" ? list.current.value : list.current._tag}</output>
