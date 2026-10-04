<!--
  The "State that survives navigation" example's side panel: who holds messagesAtom right now, and
  whether the registry still has it. Not part of the example's code: it looks at the registry from
  outside, every 100 ms, so it never holds the atom itself.
-->
<script lang="ts">
  import EventLog from "#lib/docs/kit/event-log.svelte";
  import { EventLogState } from "#lib/docs/kit/event-log.svelte.ts";
  import Part from "#lib/docs/kit/part.svelte";
  import { play } from "#lib/docs/kit/sound.ts";
  import { exampleTouched, getExampleState } from "#lib/docs/kit/tone.ts";
  import { getRegistry } from "effect-atom-svelte";

  import { messagesAtom } from "./chat.ts";

  interface Props {
    /** Whether the chat page is open, and so reads the atom. */
    readonly chatOpen: boolean;
    /** Whether the layout holds the atom with useAtomMount. */
    readonly heldByLayout: boolean;
  }

  const { chatOpen, heldByLayout }: Props = $props();

  const example = getExampleState();
  const registry = getRegistry();
  const log = new EventLogState();

  let inRegistry = $state(false);
  $effect(() => {
    const timer = setInterval(() => {
      const now = registry.getNodes().has(messagesAtom);
      if (now !== inRegistry) {
        if (now) {
          log.add("created, empty", { tone: "success" });
        } else {
          log.add("disposed: messages lost", { tone: "failure" });
          if (exampleTouched(example)) {
            play("reset");
          }
        }
        inRegistry = now;
      }
    }, 100);
    return () => clearInterval(timer);
  });

  const holders = $derived([
    ...(chatOpen ? ["chat/+page.svelte · useAtom"] : []),
    ...(heldByLayout ? ["+layout.svelte · useAtomMount"] : []),
  ]);
</script>

<div>
  <Part
    code
    count={holders.length}
    countLabel="holders"
    dashed={!inRegistry}
    data-testid="messages-status"
    label="messagesAtom"
    tone={inRegistry ? "success" : "idle"}
  >
    <p class="m-0 text-xs text-muted-foreground">
      {inRegistry ? "In the registry, held by:" : "Not in the registry."}
    </p>
    {#if holders.length > 0}
      <ul class="mt-1.5 mb-0 grid list-none gap-1 p-0">
        {#each holders as holder (holder)}
          <li class="m-0"><code class="text-xs">{holder}</code></li>
        {/each}
      </ul>
    {:else if inRegistry}
      <p class="m-0 mt-1.5 text-xs">Nothing, so it is about to go.</p>
    {/if}
  </Part>
  <EventLog
    code
    data-testid="messages-log"
    empty="Open Chat to create it."
    entries={log.entries}
    label="messagesAtom"
  />
</div>
