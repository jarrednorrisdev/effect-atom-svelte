<script lang="ts">
  import { useAtom } from "effect-atom-svelte";

  import { messagesAtom } from "./chat.ts";

  // Reading the messages holds the atom while this page is open.
  const messages = useAtom(messagesAtom);
  let draft = $state("");

  const send = (event: SubmitEvent) => {
    event.preventDefault();
    if (draft.trim() !== "") {
      messages.current = [...messages.current, draft.trim()];
      draft = "";
    }
  };
</script>

<form class="flex gap-2" onsubmit={send}>
  <input
    aria-label="Message"
    bind:value={draft}
    class="min-w-0 flex-1"
    placeholder="Say hi"
  />
  <button>Send</button>
</form>
<ul class="mt-2 mb-0 list-none p-0" data-testid="chat-messages">
  {#each messages.current as message, index (index)}
    <li class="m-0"><output>{message}</output></li>
  {:else}
    <li class="m-0 text-muted-foreground">No messages yet.</li>
  {/each}
</ul>
