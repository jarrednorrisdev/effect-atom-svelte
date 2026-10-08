<script lang="ts">
  import { useAtomSuspense } from "../../src/index.ts";
  import { skewAtom } from "./skew-seed.ts";

  const value = useAtomSuspense(skewAtom);
</script>

<output>{await value.current}</output>
