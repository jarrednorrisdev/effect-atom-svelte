<!-- Reads the seeded list for "a", asking for it to run again once hydrated only when `revalidate`. -->
<script lang="ts">
  import { useAtomSuspense } from "../../src/index.ts";
  import { listFor } from "./seeded-list.ts";

  const { revalidate }: { revalidate: boolean } = $props();
  // svelte-ignore state_referenced_locally
  const list = useAtomSuspense(listFor("a"), { revalidateOnHydrate: revalidate });
</script>

<output>{await list.current}</output>
