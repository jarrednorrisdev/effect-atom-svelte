<script lang="ts">
  import { useAtomSuspense } from "../../src/index.ts";
  import { FamilyUser } from "./scoped-seed.ts";

  const user = useAtomSuspense(FamilyUser.use());
</script>

<output>{await user.current}</output>
