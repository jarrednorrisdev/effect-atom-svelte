<!-- A layout giving an atom a default with initialValues and reading it above a page's
     HydrationBoundary, which hydrates the atom's fresh value. -->
<script lang="ts">
  import { HydrationBoundary, RegistryProvider, useAtomValue } from "../../src/index.ts";
  import {
    providerSeedAtom,
    providerSeedSeen,
    providerSeedState,
  } from "./provider-seed.ts";
  import Run from "./run.svelte";
</script>

<RegistryProvider initialValues={[[providerSeedAtom, 1]]}>
  <Run
    setup={() => {
      const value = useAtomValue(providerSeedAtom);
      return () => `above ${value.current}`;
    }}
  />
  <HydrationBoundary state={providerSeedState}>
    <Run
      setup={() => {
        const value = useAtomValue(providerSeedAtom);
        return () => {
          providerSeedSeen.push(value.current);
          return value.current;
        };
      }}
    />
  </HydrationBoundary>
</RegistryProvider>
