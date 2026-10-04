<script module lang="ts">
  import { Effect, Schema } from "effect";
  import { AsyncResult, Atom } from "effect/reactivity";

  import { browser } from "$app/env";

  // Records where it ran.
  const where = Effect.sync((): string => (browser ? "browser" : "server")).pipe(
    Effect.delay("300 millis")
  );
  const serializable = (key: string) =>
    Atom.serializable({ key, schema: AsyncResult.Schema({ success: Schema.String }) });

  const keyedAtom = Atom.make(where).pipe(serializable("travel-keyed"));
  // No serialization key: its result can't be encoded for the trip.
  const plainAtom = Atom.make(where);
  const valueOnlyAtom = Atom.make(where).pipe(serializable("travel-value-only"));
</script>

<script lang="ts">
  import { useAtomResult, useAtomValue } from "effect-atom-svelte";
  import Origin from "#lib/docs/kit/origin.svelte";
  import ServerRow from "#lib/docs/kit/server-row.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  const keyed = await useAtomResult(keyedAtom);
  const plain = await useAtomResult(plainAtom);
  // Read after the awaits, so the server renders it before it has a result.
  const valueOnly = useAtomValue(valueOnlyAtom);

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
