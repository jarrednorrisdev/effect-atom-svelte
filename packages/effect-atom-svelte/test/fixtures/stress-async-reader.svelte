<!-- Awaits the async chain in markup and in a $derived, and a new async atom per count, next to a sync read. -->
<script lang="ts">
  import { useAtomSuspense, useAtomValue } from "../../src/index.ts";
  import type { StressAtoms } from "./stress.ts";

  const { atoms, id }: { atoms: StressAtoms; id: number } = $props();
  // svelte-ignore state_referenced_locally
  const delayed = useAtomSuspense(atoms.delayed);
  // svelte-ignore state_referenced_locally
  const delayedLabel = useAtomSuspense(atoms.delayedLabel);
  // svelte-ignore state_referenced_locally
  const label = useAtomValue(atoms.label);
  // svelte-ignore state_referenced_locally
  const count = useAtomValue(atoms.count);
  // svelte-ignore state_referenced_locally
  const forCount = useAtomSuspense(() => atoms.delayedForCount(count.current));
  const value = $derived(await delayed.current);
</script>

<span data-testid="async-{id}">{value} {await delayedLabel.current} {await forCount.current} {label.current}</span>
