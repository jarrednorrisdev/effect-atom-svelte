<script module lang="ts">
  import { Effect, Schema } from "effect";
  import type { Duration } from "effect";
  import { AsyncResult, Atom } from "effect/reactivity";

  import { browser } from "$app/env";

  // Records where it ran, after a delay.
  const where = (delay: Duration.Input) =>
    Effect.sync((): string => (browser ? "browser" : "server")).pipe(Effect.delay(delay));
  const serializable = (key: string) =>
    Atom.serializable({ key, schema: AsyncResult.Schema({ success: Schema.String }) });

  const keyedAtom = Atom.make(where("300 millis")).pipe(serializable("travel-keyed"));
  // No serialization key: its result can't be encoded for the trip.
  const plainAtom = Atom.make(where("300 millis"));
  // Slower than the others, so the server's render is done before it has a result.
  const valueOnlyAtom = Atom.make(where("1500 millis")).pipe(serializable("travel-value-only"));
</script>

<script lang="ts">
  import { useAtomResult, useAtomValue } from "effect-atom-svelte";
  import Origin from "#lib/docs/kit/origin.svelte";
  import ServerRow from "#lib/docs/kit/server-row.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  // Every hook before the first await, which is where hydrating stops.
  const valueOnly = useAtomValue(valueOnlyAtom);
  const [keyed, plain] = await Promise.all([
    useAtomResult(keyedAtom),
    useAtomResult(plainAtom),
  ]);

  const rows = [
    { id: "travel-keyed", read: "serializable, useAtomResult", result: keyed },
    { id: "travel-plain", read: "no key, useAtomResult", result: plain },
    { id: "travel-value-only", read: "serializable, useAtomValue", result: valueOnly },
  ];
</script>

{#each rows as row (row.id)}
  <ServerRow id={row.id} read={row.read}>
    {#if row.result.current._tag === "Success"}
      <Origin where={row.result.current.value} />
    {:else}
      <StateBadge result={row.result.current} />
    {/if}
  </ServerRow>
{/each}
