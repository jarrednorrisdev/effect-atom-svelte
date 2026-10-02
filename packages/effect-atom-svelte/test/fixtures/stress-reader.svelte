<!-- Reads every level of the sync chain, some through $derived, and follows a getter to a new atom per count. -->
<script lang="ts">
  import { useAtomValue } from "../../src/index.ts";
  import type { StressAtoms } from "./stress.ts";

  const { atoms, id }: { atoms: StressAtoms; id: number } = $props();
  // svelte-ignore state_referenced_locally
  const label = useAtomValue(atoms.label);
  // svelte-ignore state_referenced_locally
  const doubled = useAtomValue(atoms.doubled);
  // svelte-ignore state_referenced_locally
  const plusOne = useAtomValue(atoms.plusOne);
  // svelte-ignore state_referenced_locally
  const clicks = useAtomValue(atoms.clicksLabel);
  // svelte-ignore state_referenced_locally
  const count = useAtomValue(atoms.count);
  // svelte-ignore state_referenced_locally
  const forCount = useAtomValue(() => atoms.forCount(count.current));
  const summary = $derived(`${label.current} ${doubled.current}`);
</script>

<span data-testid="sync-{id}">{summary} {plusOne.current} {forCount.current}</span>
<span data-testid="clicks-{id}">{clicks.current}</span>
