<script module lang="ts">
  import { Effect, Queue, Stream } from "effect";
  import { Atom } from "effect/reactivity";

  // The browser's EventSource. The hosted site runs the demo API in this
  // tab, and there this one reads the events from it.
  import { EventSource } from "#lib/in-tab-api.ts";

  // The demo server sends a numbered message every 600 milliseconds.
  const messages = Stream.callback<string>((queue) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        const source = new EventSource("/api/events");
        source.addEventListener("message", (event) => {
          Queue.offerUnsafe(queue, String(event.data));
        });
        return source;
      }),
      (source) => Effect.sync(() => source.close())
    )
  );

  // How many messages arrived, and the last five. Capped, so a connection
  // left open doesn't grow the list forever. withServerValueInitial keeps
  // the connection off the server.
  const messagesAtom = Atom.make(
    messages.pipe(
      Stream.scan(
        () => ({ count: 0, latest: [] as string[] }),
        ({ count, latest }, message) => ({
          count: count + 1,
          latest: [...latest, message].slice(-5),
        })
      )
    )
  ).pipe(Atom.withServerValueInitial);
</script>

<script lang="ts">
  import { useAtomValue } from "effect-atom-svelte";
  import Cue from "#lib/docs/kit/cue.svelte";
  import FlashValue from "#lib/docs/kit/flash-value.svelte";
  import { enter } from "#lib/docs/kit/motion.ts";

  const messages = useAtomValue(messagesAtom);
  const received = $derived(
    messages.current._tag === "Success"
      ? messages.current.value
      : { count: 0, latest: [] }
  );
</script>

<Cue cue="tick" on={received.count} />
<p>
  <FlashValue data-testid="socket-count" value={received.count} /> messages
</p>
<ol class="flex list-none flex-wrap gap-1.5 p-0" data-testid="socket-messages">
  {#each received.latest as message (message)}
    <li class="m-0" {@attach enter()}><output>Message {message}</output></li>
  {:else}
    <li aria-busy="true">Waiting for the first message…</li>
  {/each}
</ol>
