<script lang="ts" module>
  import { Atom } from "effect/reactivity";

  export const sharedAtom = Atom.make(0);
</script>

<script lang="ts">
  const { start = 0 }: { start?: number } = $props();
  let clicks = $state(0);
</script>

<button onclick={() => (clicks += 1)} type="button">{start + clicks}</button>
