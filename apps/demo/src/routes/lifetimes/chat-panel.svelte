<script lang="ts">
  import type { Atom } from "effect/reactivity";
  import { useAtomMount } from "effect-atom-svelte";

  const { socket }: { socket: Atom.Atom<string> } = $props();

  // Holds the atom for as long as this component lives. Nothing here reads it.
  useAtomMount(() => socket);
</script>

<p>&lt;ChatPanel&gt; holds the socket open</p>
