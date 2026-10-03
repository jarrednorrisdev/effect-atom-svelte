<script lang="ts">
  import { useAtomSuspense } from "../../src/index.ts";
  import { pendingOnServer } from "./server-value.ts";

  const value = useAtomSuspense(pendingOnServer);
</script>

<output>{await value.current}</output>
