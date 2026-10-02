<!--
  Hydrates dehydrated atom state, for example from `Hydration.dehydrate` returned by a remote
  function. Atoms new to the registry are hydrated before children render; atoms that already
  exist are updated after render, so current UI does not jump to the incoming data mid-render.
-->
<script lang="ts">
  import { Hydration } from "effect/reactivity";
  import type { Snippet } from "svelte";

  import { getRegistry } from "./RegistryContext.ts";

  interface Props {
    readonly state?: Iterable<Hydration.DehydratedAtom> | undefined;
    readonly children: Snippet;
  }

  const { children, state }: Props = $props();
  const registry = getRegistry();

  const hydrateNew = (
    incoming: Iterable<Hydration.DehydratedAtom> | undefined
  ): Hydration.DehydratedAtomValue[] => {
    const nodes = registry.getNodes();
    const fresh: Hydration.DehydratedAtomValue[] = [];
    const existing: Hydration.DehydratedAtomValue[] = [];
    for (const atom of Hydration.toValues([...(incoming ?? [])])) {
      (nodes.has(atom.key) ? existing : fresh).push(atom);
    }
    Hydration.hydrate(registry, fresh);
    return existing;
  };

  // Read once at init so children render with the new atoms already in place.
  // svelte-ignore state_referenced_locally
  let hydrated = state;
  // svelte-ignore state_referenced_locally
  let deferred = hydrateNew(state);

  $effect(() => {
    const incoming = state;
    if (incoming !== hydrated) {
      hydrated = incoming;
      deferred = [...deferred, ...hydrateNew(incoming)];
    }
    if (deferred.length > 0) {
      Hydration.hydrate(registry, deferred);
      deferred = [];
    }
  });
</script>

{@render children()}
