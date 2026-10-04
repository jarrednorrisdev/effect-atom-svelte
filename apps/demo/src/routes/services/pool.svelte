<script module lang="ts">
  import { Context, Effect, Layer } from "effect";
  import { Atom } from "effect/reactivity";
  import { EventLogState } from "#lib/docs/kit/event-log.svelte.ts";

  // When the pool was built and released, for the log under the example.
  const log = new EventLogState();
  let built = 0;

  const openPool = Effect.sync(() => {
    built += 1;
    log.add(`pool ${built} built`, { tone: "running" });
    return { id: built };
  });
  const closePool = (pool: { id: number }) =>
    Effect.sync(() => {
      log.add(`pool ${pool.id} released`, { tone: "interrupted" });
    });

  // A service that is costly to build, such as a database connection pool.
  class Pool extends Context.Service<Pool, { readonly id: number }>()("demo/Pool") {}

  // The layer releases the pool when its scope closes.
  const PoolLayer = Layer.effect(Pool, Effect.acquireRelease(openPool, closePool));

  const runtime = Atom.runtime(PoolLayer);

  // Two atoms from one runtime share its pool.
  const atoms = {
    ordersAtom: runtime.atom(Pool.use((pool) => Effect.succeed(pool.id))),
    usersAtom: runtime.atom(Pool.use((pool) => Effect.succeed(pool.id))),
  };
</script>

<script lang="ts">
  import EventLog from "#lib/docs/kit/event-log.svelte";
  import Part from "#lib/docs/kit/part.svelte";
  import Reader from "./pool-reader.svelte";

  // Whether each atom has a reader on the page.
  const reading = $state({ ordersAtom: false, usersAtom: false });
  const inUse = $derived(Object.values(reading).filter(Boolean).length);
</script>

<div class="grid gap-3 sm:grid-cols-2">
  {#each ["usersAtom", "ordersAtom"] as const as name (name)}
    <Part code dashed={!reading[name]} label={name}>
      <button onclick={() => (reading[name] = !reading[name])}>
        {reading[name] ? "Remove" : "Add"} a reader of {name}
      </button>
      {#if reading[name]}
        <Reader atom={atoms[name]} {name} />
      {/if}
    </Part>
  {/each}
</div>
<div class="mt-3">
  <Part
    code
    count={inUse}
    countLabel="atoms in use"
    label="runtime"
    tone={inUse > 0 ? "success" : "idle"}
  >
    <EventLog empty="No pool yet." entries={log.entries} label="Pool" max={8} />
  </Part>
</div>
