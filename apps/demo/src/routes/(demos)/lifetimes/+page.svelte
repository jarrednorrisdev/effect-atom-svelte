<script module lang="ts">
  import { Atom, AtomRef } from "effect/reactivity";

  export const log = AtomRef.make<readonly string[]>([]);

  const tracked = (name: string) =>
    Atom.make((get) => {
      log.update((lines) => [...lines, `${new Date().toLocaleTimeString()} ${name}: computed`]);
      get.addFinalizer(() =>
        log.update((lines) => [...lines, `${new Date().toLocaleTimeString()} ${name}: disposed`])
      );
      return name;
    });

  export const plainAtom = tracked("plain");
  export const keepAliveAtom = Atom.keepAlive(tracked("keepAlive"));
  export const ttlAtom = Atom.setIdleTTL(tracked("idle TTL 3s"), "3 seconds");
</script>

<script lang="ts">
  import { useAtomRef } from "effect-atom-svelte";

  import Reader from "./reader.svelte";

  const lines = useAtomRef(log);
  let shown = $state({ keepAlive: false, plain: false, ttl: false });
</script>

<h1>Lifetimes</h1>

<section>
  <h2>Mounting and disposal</h2>
  <p>
    Each checkbox mounts a component that reads one atom. Unchecking it unmounts the reader. A plain
    atom is disposed at once, <code>keepAlive</code> never is, and an idle TTL waits three seconds.
  </p>
  <label><input bind:checked={shown.plain} type="checkbox" /> plain</label>
  <label><input bind:checked={shown.keepAlive} type="checkbox" /> keepAlive</label>
  <label><input bind:checked={shown.ttl} type="checkbox" /> idle TTL</label>
  {#if shown.plain}<Reader atom={plainAtom} />{/if}
  {#if shown.keepAlive}<Reader atom={keepAliveAtom} />{/if}
  {#if shown.ttl}<Reader atom={ttlAtom} />{/if}
  <pre data-testid="lifetimes-log">{lines.current.join("\n")}</pre>
</section>
