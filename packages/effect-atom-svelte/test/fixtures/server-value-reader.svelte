<script lang="ts">
  import { useAtomResult, useAtomSuspense } from "../../src/index.ts";
  import { pendingOnServer, valueOnServer } from "./server-value.ts";

  const result = await useAtomResult(pendingOnServer);
  const suspense = useAtomSuspense(valueOnServer);
</script>

<output>{result.current._tag === "Success" ? result.current.value : result.current._tag}</output>
<output>{await suspense.current}</output>
