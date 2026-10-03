<script module lang="ts">
  import { Atom, AtomRef } from "effect/reactivity";

  const log = AtomRef.make<readonly string[]>([]);
  const write = (line: string) =>
    log.update((lines) => [...lines, `${new Date().toLocaleTimeString()} ${line}`]);

  // An atom that logs when it is computed, and when it is disposed.
  const tracked = (name: string) =>
    Atom.make((get) => {
      write(`${name}: computed`);
      get.addFinalizer(() => write(`${name}: disposed`));
      return name;
    });

  const plainAtom = tracked("plain");
  const keepAliveAtom = Atom.keepAlive(tracked("keepAlive"));
  const ttlAtom = Atom.setIdleTTL(tracked("idle TTL"), "3 seconds");
</script>

<script lang="ts">
  import { useAtomRef } from "effect-atom-svelte";

  import Reader from "./reader.svelte";

  const lines = useAtomRef(log);
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
