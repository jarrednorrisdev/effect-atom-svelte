<script lang="ts">
  import { useAtomResult } from "../../src/index.ts";
  import { defectAtom, unencodableAtom } from "./unsent-seed.ts";

  // Both before the first await, so both read what the server sent (JND-96).
  const [defect, unencodable] = await Promise.all([
    useAtomResult(defectAtom),
    useAtomResult(unencodableAtom),
  ]);
</script>

<output>{defect.current._tag === "Success" ? defect.current.value : defect.current._tag}</output>
<output>{unencodable.current._tag === "Success" ? unencodable.current.value : unencodable.current._tag}</output>
