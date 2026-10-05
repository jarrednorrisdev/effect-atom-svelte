<script lang="ts">
  import { useAtomValue } from "../../src/index.ts";
  import { reactiveQuery } from "./reactive-query.ts";

  const result = useAtomValue(reactiveQuery);
</script>

<output>{result.current._tag === "Success" ? result.current.value : result.current._tag}</output>
