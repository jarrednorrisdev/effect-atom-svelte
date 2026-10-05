<script module lang="ts">
  import { Atom } from "effect/reactivity";

  // logged(name) returns name, and adds to the log below when the atom is computed or disposed.
  import { logged } from "./lifecycle-log.ts";

  const plainAtom = Atom.make(logged("plain"));
  const keptAtom = Atom.make(logged("keepAlive")).pipe(Atom.keepAlive);
  const idleAtom = Atom.make(logged("idle TTL")).pipe(Atom.setIdleTTL("3 seconds"));

  const atoms = [
    { atom: plainAtom, name: "plain" },
    { atom: keptAtom, name: "keepAlive" },
    { atom: idleAtom, name: "idle TTL" },
  ] as const;
</script>

<script lang="ts">
  import Holders from "./holders.svelte";
  import Reader from "./reader.svelte";
  import RegistryLog from "./registry-log.svelte";

  // How many <Reader> components each atom has.
  const readers = $state({ "idle TTL": 0, keepAlive: 0, plain: 0 });
</script>

<div class="grid gap-3 sm:grid-cols-3">
  {#each atoms as { atom, name } (name)}
    <Holders {atom} {name} readers={readers[name]}>
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
<RegistryLog data-testid="lifetimes-log" />
