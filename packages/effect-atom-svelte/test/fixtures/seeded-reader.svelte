<!-- Uses the seeded list for "a" without mounting it, and reads it only while `show` is true. -->
<script lang="ts">
  import { useAtomSuspense } from "../../src/index.ts";
  import { listFor } from "./seeded-list.ts";

  const { show }: { show: boolean } = $props();
  const list = useAtomSuspense(listFor("a"));
</script>

{#if show}
  <output>{await list.current}</output>
{/if}
