<!-- The hook is called in the script, outside the boundary; only the read is inside it (JND-86). -->
<script lang="ts">
  import { useAtomSuspense } from "../../src/index.ts";
  import { pendingBoundaryAtom } from "./pending-boundary.ts";

  const value = useAtomSuspense(pendingBoundaryAtom);
</script>

<svelte:boundary>
  <output>{await value.current}</output>
  {#snippet pending()}
    <p>loading</p>
  {/snippet}
</svelte:boundary>
