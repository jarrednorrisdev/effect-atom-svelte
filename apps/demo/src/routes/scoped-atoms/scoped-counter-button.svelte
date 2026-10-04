<script lang="ts">
  import { useAtom } from "effect-atom-svelte";
  import FlashValue from "#lib/docs/kit/flash-value.svelte";

  import { Counter } from "./counter-scope.ts";

  const { label }: { label: string } = $props();

  const count = useAtom(Counter.use());
</script>

<span class="inline-flex items-center gap-1">
  <FlashValue aria-label="{label} count" value={count.current} />
  <button aria-label="{label}: add one" onclick={() => (count.current += 1)}>+1</button>
</span>
