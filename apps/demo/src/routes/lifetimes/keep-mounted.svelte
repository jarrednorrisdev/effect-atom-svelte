<script lang="ts">
  import Part from "#lib/docs/kit/part.svelte";

  import ChatPage from "./chat-page.svelte";
  import KeepMessages from "./keep-messages.svelte";

  // A tiny app: a layout around two pages.
  let page = $state<"inbox" | "chat">("inbox");
  let holdInLayout = $state(false);
</script>

<Part code label="+layout.svelte">
  <p>
    <button aria-pressed={holdInLayout} onclick={() => (holdInLayout = !holdInLayout)}>
      Hold messagesAtom in the layout
    </button>
  </p>
  <!-- The layout stays while the pages change, so whatever it holds stays too. -->
  {#if holdInLayout}<KeepMessages />{/if}
  <div aria-label="Page" class="flex gap-2" role="group">
    <button aria-pressed={page === "inbox"} onclick={() => (page = "inbox")}>
      Inbox
    </button>
    <button aria-pressed={page === "chat"} onclick={() => (page = "chat")}>
      Chat
    </button>
  </div>
  <div class="mt-3">
    <Part code label="{page}/+page.svelte">
      {#if page === "chat"}
        <ChatPage />
      {:else}
        <p class="m-0">Nothing on this page reads messagesAtom.</p>
      {/if}
    </Part>
  </div>
</Part>
