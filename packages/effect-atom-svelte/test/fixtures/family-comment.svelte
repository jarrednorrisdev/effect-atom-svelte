<script lang="ts">
  import { useAtomSuspense } from "../../src/index.ts";
  import { userFamily } from "./scoped-seed.ts";

  const { authorId }: { readonly authorId: string } = $props();
  const author = useAtomSuspense(() => userFamily(authorId));
</script>

<output>{await author.current}</output>
