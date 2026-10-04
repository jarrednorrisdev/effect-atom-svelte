<script lang="ts">
  import { useAtomMount } from "effect-atom-svelte";

  import { socketAtom } from "./socket.ts";

  // Holds the socket for as long as this component lives. Nothing here reads it.
  useAtomMount(socketAtom);
</script>
