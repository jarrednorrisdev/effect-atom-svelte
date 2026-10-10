<!-- A root layout giving a wrapped serializable atom an initial value, which goes to its source, and
     a page hydrating the source's value and reading the wrapper. -->
<script lang="ts">
  import { Atom } from "effect/reactivity";

  import { HydrationBoundary, RegistryProvider } from "../../src/index.ts";
  import Reader from "./initial-seed-reader.svelte";
  import {
    initialSeedAtom,
    initialSeedState,
    initialSeedValue,
  } from "./initial-seed.ts";

  const wrapped = initialSeedAtom.pipe(Atom.withRefresh("1 hour"));
</script>

<RegistryProvider initialValues={[[wrapped, initialSeedValue]]}>
  <HydrationBoundary state={initialSeedState}>
    <Reader atom={wrapped} />
  </HydrationBoundary>
</RegistryProvider>
