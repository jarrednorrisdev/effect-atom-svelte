<script lang="ts">
  import { useAtomSuspense } from "../../src/index.ts";
  import { ScopedUser } from "./scoped-seed.ts";

  const user = useAtomSuspense(ScopedUser.use());
</script>

<output>{await user.current}</output>
