<script module lang="ts">
  import { Stream } from "effect";
  import { Atom } from "effect/reactivity";

  import { TodosRpc } from "#lib/clients.ts";

  // Client-only: during SSR the stream would never settle, so the server renders Initial.
  const clockAtom = Atom.withServerValueInitial(
    Atom.make(Stream.tick("1 second").pipe(Stream.scan(() => 0, (n) => n + 1)))
  );
  const ticksAtom = TodosRpc.query("ticks", { count: 5 });
</script>

<script lang="ts">
  import { AsyncResult } from "effect/reactivity";
  import { useAtomSet, useAtomValue } from "effect-atom-svelte";

  const clock = useAtomValue(clockAtom);
  const ticks = useAtomValue(ticksAtom);
  const pull = useAtomSet(ticksAtom);
</script>

<h1>Streams</h1>

<section>
  <h2>Stream atoms</h2>
  <p>
    An atom backed by <code>Stream.tick</code>. It starts when something reads it and stops when the
    last reader goes away. <code>withServerValueInitial</code> keeps it off the server.
  </p>
  <p>
    Seconds on this page:
    <output data-testid="clock">{AsyncResult.getOrElse(clock.current, () => "starting")}</output>
  </p>
</section>

<section>
  <h2>Streaming RPC, pulled chunk by chunk</h2>
  <p>
    A stream RPC becomes a pull atom. Writing to it pulls the next chunk until the server's stream
    ends. Over HTTP the server doesn't wait for the client, so a chunk holds every tick that arrived
    since the last pull: wait a second before clicking and you get several at once.
  </p>
  {#if ticks.current._tag === "Success"}
    <p data-testid="ticks">
      {ticks.current.value.items.join(", ")}{ticks.current.value.done ? " (done)" : ""}
    </p>
    <button disabled={ticks.current.value.done || ticks.current.waiting} onclick={() => pull(undefined)}>
      Pull next
    </button>
  {:else}
    <p>{ticks.current._tag}</p>
  {/if}
</section>
