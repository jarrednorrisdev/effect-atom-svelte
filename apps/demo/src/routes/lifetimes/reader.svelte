<script lang="ts">
  import type { Atom } from "effect/reactivity";
  import { useAtomValue } from "effect-atom-svelte";

  const { atom }: { atom: Atom.Atom<number | string> } = $props();
  // svelte-ignore state_referenced_locally
  const value = useAtomValue(atom);
</script>

<p>Reading <code>{value.current}</code></p>
