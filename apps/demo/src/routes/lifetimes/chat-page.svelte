<script lang="ts">
  import { useAtomValue } from "effect-atom-svelte";

  import { socketAtom } from "./socket.ts";

  // The chat page reads the socket, so it is held while the page is open.
  const socket = useAtomValue(socketAtom);
</script>

<p class="m-0">Chatting on connection <output>{socket.current}</output></p>
