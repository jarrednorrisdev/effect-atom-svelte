<script module lang="ts">
  import { Atom } from "effect/reactivity";

  interface LifeEvent {
    readonly atom: string;
    readonly event: "computed" | "disposed";
  }

  // The log is an atom too. The component below reads it for as long as it lives.
  const logAtom = Atom.make<readonly LifeEvent[]>([]);

  // An atom that logs when it is computed, and when it is disposed.
  const tracked = (name: string) =>
    Atom.make((get) => {
      // Finalizers run after the atom is disposed, so write through the registry.
      const log = (event: LifeEvent["event"]) =>
        get.registry.update(logAtom, (events) => [...events, { atom: name, event }]);
      log("computed");
      get.addFinalizer(() => log("disposed"));
      return name;
    });

  const atoms = [
    { atom: tracked("plain"), name: "plain" },
    { atom: tracked("keepAlive").pipe(Atom.keepAlive), name: "keepAlive" },
    { atom: tracked("idle TTL").pipe(Atom.setIdleTTL("3 seconds")), name: "idle TTL" },
  ] as const;
</script>

<script lang="ts">
  import { useAtomValue } from "effect-atom-svelte";

  import Holders from "./holders.svelte";
  import Reader from "./reader.svelte";
  import RegistryLog from "./registry-log.svelte";

  const events = useAtomValue(logAtom);
  // How many <Reader> components each atom has.
  const readers = $state({ "idle TTL": 0, keepAlive: 0, plain: 0 });
</script>

<div class="grid gap-3 sm:grid-cols-3">
  {#each atoms as { atom, name } (name)}
    <Holders {atom} events={events.current} {name} readers={readers[name]}>
      <p>
        <button
          aria-label="{name}: add a reader"
          data-cue="up"
          onclick={() => (readers[name] += 1)}>
          + Reader
        </button>
        <button
          aria-label="{name}: remove a reader"
          data-cue="down"
          disabled={readers[name] === 0}
          onclick={() => (readers[name] -= 1)}
        >
          − Reader
        </button>
      </p>
      {#each { length: readers[name] }, index (index)}
        <Reader {atom} />
      {/each}
    </Holders>
  {/each}
</div>
<RegistryLog data-testid="lifetimes-log" events={events.current} />
