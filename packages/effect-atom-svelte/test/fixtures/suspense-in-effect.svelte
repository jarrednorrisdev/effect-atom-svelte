<!-- Awaits useAtomSuspense's promise in an $effect only, recording each value the await yields. -->
<script lang="ts">
  import type { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";

  import { provideRegistry, useAtomSuspense } from "../../src/index.ts";

  interface Props {
    readonly atom: Atom.Atom<AsyncResult.AsyncResult<number, never>>;
    readonly registry: AtomRegistry.AtomRegistry;
    readonly seen: unknown[];
  }

  const { atom, registry, seen }: Props = $props();
  // svelte-ignore state_referenced_locally
  provideRegistry({ registry });
  // svelte-ignore state_referenced_locally
  const value = useAtomSuspense(atom);
  $effect(() => {
    const promise = value.current;
    void (async () => {
      seen.push(await promise);
    })();
  });
</script>

<output>ok</output>
