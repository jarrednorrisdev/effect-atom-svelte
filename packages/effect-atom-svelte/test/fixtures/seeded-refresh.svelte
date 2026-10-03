<script lang="ts">
  import { useAtomRefresh, useAtomResult } from "../../src/index.ts";
  import { listFor } from "./seeded-list.ts";

  const list = await useAtomResult(listFor("a"));
  const refresh = useAtomRefresh(listFor("a"));
</script>

<button onclick={refresh}>refresh</button>
<output>{list.current._tag === "Success" ? list.current.value : list.current._tag}</output>
