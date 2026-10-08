<script lang="ts">
  import { useAtomResult } from "../../src/index.ts";
  import { keptAtom } from "./revalidate.ts";
  import { defectAtom } from "./unsent-seed.ts";

  const kept = await useAtomResult(keptAtom);
  // After the first await: no seed, but the server sent none for a defect either.
  const defect = await useAtomResult(defectAtom);
</script>

<output>{kept.current._tag === "Success" ? kept.current.value : kept.current._tag}</output>
<output>{defect.current._tag === "Success" ? defect.current.value : defect.current._tag}</output>
