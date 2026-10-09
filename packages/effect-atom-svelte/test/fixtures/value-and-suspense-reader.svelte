<script lang="ts">
  import { useAtomSuspense, useAtomValue } from "../../src/index.ts";
  import { listFor } from "./seeded-list.ts";

  // The badge reads the atom before the list awaits it.
  const badge = useAtomValue(listFor("a"));
  const list = useAtomSuspense(listFor("a"));
</script>

<output>{badge.current._tag}</output>
<svelte:boundary>
  <output>{await list.current}</output>
</svelte:boundary>
