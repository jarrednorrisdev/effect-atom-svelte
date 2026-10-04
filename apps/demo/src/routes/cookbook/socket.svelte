<script lang="ts">
  import Part from "#lib/docs/kit/part.svelte";

  import Messages from "./messages.svelte";

  // While nothing reads messagesAtom, the connection is closed.
  let connected = $state(false);
</script>

<p>
  <button
    data-cue={connected ? "interrupt" : "start"}
    onclick={() => (connected = !connected)}
  >
    {connected ? "Disconnect" : "Connect"}
  </button>
</p>
<Part
  dashed={!connected}
  label="Reader"
  tone={connected ? "running" : "idle"}
>
  {#if connected}
    <Messages />
  {:else}
    <p data-testid="socket-closed">
      Nothing reads messagesAtom, so the connection is closed.
    </p>
  {/if}
</Part>
