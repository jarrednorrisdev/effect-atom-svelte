<script lang="ts">
  import BrowserFrame from "#lib/docs/kit/browser-frame.svelte";

  import ChatPage from "./chat-page.svelte";
  import KeepMessages from "./keep-messages.svelte";
  import MessagesStatus from "./messages-status.svelte";

  // A tiny app: this file is its layout, around two pages.
  let page = $state<"inbox" | "chat">("inbox");
  let holdInLayout = $state(false);
</script>

<div class="grid gap-4 md:grid-cols-[1fr_16.5rem]">
  <BrowserFrame bind:page pages={["inbox", "chat"]}>
    {#snippet bar()}
      <code class="text-xs">+layout.svelte</code>
      <button
        aria-pressed={holdInLayout}
        onclick={() => (holdInLayout = !holdInLayout)}
      >
        useAtomMount(messagesAtom)
      </button>
    {/snippet}
    <!-- The layout stays while the pages change, so whatever it holds stays too. -->
    {#if holdInLayout}<KeepMessages />{/if}
    {#if page === "chat"}
      <ChatPage />
    {:else}
      <p class="m-0 text-muted-foreground">
        No new mail. This page doesn't read messagesAtom.
      </p>
    {/if}
  </BrowserFrame>
  <MessagesStatus chatOpen={page === "chat"} heldByLayout={holdInLayout} />
</div>
