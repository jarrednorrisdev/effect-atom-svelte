<script lang="ts">
  import { useAtomResult } from "../../src/index.ts";
  import { defectAtom, unencodableAtom } from "./unsent-seed.ts";

  const defect = await useAtomResult(defectAtom);
  const unencodable = await useAtomResult(unencodableAtom);
</script>

<output>{defect.current._tag === "Success" ? defect.current.value : defect.current._tag}</output>
<output>{unencodable.current._tag === "Success" ? unencodable.current.value : unencodable.current._tag}</output>
