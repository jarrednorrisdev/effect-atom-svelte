<script module lang="ts">
  import { Atom } from "effect/reactivity";

  // Created once, when the module loads, and shared by every <Counter>.
  const countAtom = Atom.make(0);
</script>

<script lang="ts">
  import { useAtom } from "effect-atom-svelte";
  import FlashValue from "#lib/docs/kit/flash-value.svelte";
  import Part from "#lib/docs/kit/part.svelte";

  const { label }: { label: string } = $props();

  const count = useAtom(countAtom);
</script>

<Part {label}>
  <span class="button-group">
    <button aria-label="{label}: decrement" onclick={() => (count.current -= 1)}>
      −
    </button>
    <FlashValue value={count.current} />
    <button aria-label="{label}: increment" onclick={() => (count.current += 1)}>
      +
    </button>
  </span>
</Part>
