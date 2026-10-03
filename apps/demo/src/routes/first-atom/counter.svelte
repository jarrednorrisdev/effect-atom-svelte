<script module lang="ts">
  import { Atom } from "effect/reactivity";

  // Created once, when the module loads, and shared by every <Counter>.
  const countAtom = Atom.make(0);
</script>

<script lang="ts">
  import { useAtom } from "effect-atom-svelte";

  const { label }: { label: string } = $props();

  const count = useAtom(countAtom);
</script>

<p>
  {label}:
  <button aria-label="{label}: decrement" onclick={() => (count.current -= 1)}>−</button>
  <output>{count.current}</output>
  <button aria-label="{label}: increment" onclick={() => (count.current += 1)}>+</button>
</p>
