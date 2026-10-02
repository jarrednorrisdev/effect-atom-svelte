<!-- Shows one useAtomSuspense handle's promise behind a toggle, recording each promise it reads. -->
<script lang="ts">
  import type { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";

  import { provideRegistry, useAtomSuspense } from "../../src/index.ts";

  interface Props {
    readonly atom: Atom.Atom<AsyncResult.AsyncResult<string>>;
    readonly registry: AtomRegistry.AtomRegistry;
    readonly promises: Promise<unknown>[];
  }

  const { atom, promises, registry }: Props = $props();
  // svelte-ignore state_referenced_locally
  provideRegistry({ registry });
  // svelte-ignore state_referenced_locally
  const value = useAtomSuspense(atom);
  let show = $state(true);
  const record = (promise: Promise<string>) => {
    promises.push(promise);
    return promise;
  };
</script>

<button onclick={() => (show = !show)}>toggle</button>
{#if show}
  <output>{await record(value.current)}</output>
{/if}
