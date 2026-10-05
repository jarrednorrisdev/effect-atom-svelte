<script lang="ts">
  import { useAtomSuspense } from "../../src/index.ts";
  import { pendingBoundaryAtom } from "./pending-boundary.ts";

  const value = useAtomSuspense(pendingBoundaryAtom);
</script>

<output>{await value.current}</output>
