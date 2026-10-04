<script lang="ts">
  import { useAtomValue } from "effect-atom-svelte";
  import Part from "#lib/docs/kit/part.svelte";

  import ChatPage from "./chat-page.svelte";
  import KeepSocket from "./keep-socket.svelte";
  import RegistryLog from "./registry-log.svelte";
  import { logAtom } from "./socket.ts";

  const events = useAtomValue(logAtom);

  // A tiny app: a layout around two pages.
  let page = $state<"inbox" | "chat">("inbox");
  let holdInLayout = $state(false);
</script>

<Part code label="+layout.svelte">
  <p>
    <button aria-pressed={holdInLayout} onclick={() => (holdInLayout = !holdInLayout)}>
      Hold socketAtom in the layout
    </button>
  </p>
  <!-- The layout stays while the pages change, so whatever it holds stays too. -->
  {#if holdInLayout}<KeepSocket />{/if}
  <div aria-label="Page" class="flex gap-2" role="group">
    <button aria-pressed={page === "inbox"} onclick={() => (page = "inbox")}>Inbox</button>
    <button aria-pressed={page === "chat"} onclick={() => (page = "chat")}>Chat</button>
  </div>
  <div class="mt-3">
    <Part code label="{page}/+page.svelte">
      {#if page === "chat"}
        <ChatPage />
      {:else}
        <p class="m-0">Nothing on this page uses the socket.</p>
      {/if}
    </Part>
  </div>
</Part>
<RegistryLog
  code
  data-testid="mount-log"
  empty="Nothing yet. Open the chat page."
  events={events.current}
  label="socketAtom"
/>
