<script module lang="ts">
  import { Effect } from "effect";
  import { Atom } from "effect/reactivity";
  import { EventLogState } from "#lib/docs/kit/event-log.svelte.ts";

  // What the pretend socket server saw, for the log under the example.
  export const server = new EventLogState();
  let opened = 0;

  // A pretend socket: the server logs when it opens and when it closes.
  const openSocket = Effect.sync(() => {
    opened += 1;
    server.add(`socket ${opened} opened`, { tone: "running" });
    return { id: opened };
  });
  const closeSocket = (socket: { id: number }) =>
    Effect.sync(() => {
      server.add(`socket ${socket.id} closed`, { tone: "interrupted" });
    });

  // The socket belongs to the atom's scope: it closes when the atom is disposed,
  // and before the effect runs again.
  const feedAtom = Atom.make(
    Effect.gen(function* readFeed() {
      const socket = yield* Effect.acquireRelease(openSocket, closeSocket);
      yield* Effect.sleep("400 millis");
      return `First message on socket ${socket.id}`;
    })
  );
</script>

<script lang="ts">
  import { useAtomRefresh, useAtomValue } from "effect-atom-svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  const feed = useAtomValue(feedAtom);
  const refresh = useAtomRefresh(feedAtom);
</script>

<p class="flex flex-wrap items-baseline gap-3">
  {#if feed.current._tag === "Success"}
    <ResultChip
      busy={feed.current.waiting}
      kind="message"
      label="feedAtom"
      tone="success"
    >
      <span data-testid="feed">{feed.current.value}</span>
    </ResultChip>
  {:else}
    <ResultChip kind="message" label="feedAtom" tone="running">
      Connecting…
    </ResultChip>
  {/if}
  <StateBadge data-testid="feed-state" result={feed.current} />
  <button onclick={refresh}>Reconnect</button>
</p>
