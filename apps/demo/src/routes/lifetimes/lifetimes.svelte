<script module lang="ts">
  import { Atom } from "effect/reactivity";

  // The log is an atom too. The component below reads it for as long as it lives.
  const logAtom = Atom.make<readonly string[]>([]);

  // An atom that logs when it is computed, and when it is disposed.
  const tracked = (name: string) =>
    Atom.make((get) => {
      // Finalizers run after the atom is disposed, so write through the registry.
      const log = (event: string) =>
        get.registry.update(logAtom, (lines) => [
          ...lines,
          `${new Date().toLocaleTimeString()} ${name}: ${event}`,
        ]);
      log("computed");
      get.addFinalizer(() => log("disposed"));
      return name;
    });

  const plainAtom = tracked("plain");
  const keepAliveAtom = tracked("keepAlive").pipe(Atom.keepAlive);
  const ttlAtom = tracked("idle TTL").pipe(Atom.setIdleTTL("3 seconds"));
</script>

<script lang="ts">
  import { useAtomValue } from "effect-atom-svelte";

  import Reader from "./reader.svelte";

  const lines = useAtomValue(logAtom);
  let shown = $state({ keepAlive: false, plain: false, ttl: false });
</script>

<p>
  <label><input bind:checked={shown.plain} type="checkbox" /> plain</label>
  <label><input bind:checked={shown.keepAlive} type="checkbox" /> keepAlive</label>
  <label><input bind:checked={shown.ttl} type="checkbox" /> idle TTL</label>
</p>
{#if shown.plain}<Reader atom={plainAtom} />{/if}
{#if shown.keepAlive}<Reader atom={keepAliveAtom} />{/if}
{#if shown.ttl}<Reader atom={ttlAtom} />{/if}
<pre data-testid="lifetimes-log">{lines.current.join("\n")}</pre>
