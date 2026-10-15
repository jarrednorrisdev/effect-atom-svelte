<script lang="ts">
  import { useAtomValue } from "effect-atom-svelte";
  import type { Atom } from "effect/reactivity";

  const { atom }: { atom: Atom.Atom<number | string> } = $props();
  // A getter, so the hook follows the prop.
  const value = useAtomValue(() => atom);
</script>

<p>Reading <code>{value.current}</code></p>
