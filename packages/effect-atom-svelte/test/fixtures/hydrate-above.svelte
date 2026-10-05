<!-- A HydrationBoundary, with an optional reader of the same atom above it. -->
<script lang="ts">
  import type { Atom, AtomRegistry, Hydration } from "effect/reactivity";

  import {
    HydrationBoundary,
    provideRegistry,
    useAtomValue,
  } from "../../src/index.ts";
  import Run from "./run.svelte";

  interface Props {
    readonly atom: Atom.Atom<number>;
    readonly state: Iterable<Hydration.DehydratedAtom> | undefined;
    /** Reads the atom above the boundary, so it is in the registry before the boundary runs. */
    readonly readAbove: boolean;
    /** Reads the atom inside the boundary; otherwise its child shows "-". */
    readonly readInside: boolean;
    readonly registry?: AtomRegistry.AtomRegistry | undefined;
  }

  const { atom, readAbove, readInside, registry, state }: Props = $props();
  // svelte-ignore state_referenced_locally
  provideRegistry({ registry });
  // svelte-ignore state_referenced_locally
  const above = readAbove ? useAtomValue(atom) : undefined;
</script>

<p>{above ? above.current : "-"}</p>
<HydrationBoundary {state}>
  <Run
    setup={() => {
      if (!readInside) {
        return () => "-";
      }
      const inside = useAtomValue(atom);
      return () => inside.current;
    }}
  />
</HydrationBoundary>
