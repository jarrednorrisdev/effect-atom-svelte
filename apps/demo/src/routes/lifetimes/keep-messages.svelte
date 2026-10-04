<script lang="ts">
  import { useAtomMount } from "effect-atom-svelte";

  import { messagesAtom } from "./chat.ts";

  // Holds the messages for as long as this component lives. Nothing here reads them.
  useAtomMount(messagesAtom);
</script>
