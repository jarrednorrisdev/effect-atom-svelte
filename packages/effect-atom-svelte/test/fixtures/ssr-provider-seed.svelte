<!-- A root layout giving an atom a default with initialValues, and a page hydrating its fresh value. -->
<script lang="ts">
  import { BROWSER } from "esm-env";

  import { HydrationBoundary, RegistryProvider, useAtomValue } from "../../src/index.ts";
  import {
    providerSeedAtom,
    providerSeedSeen,
    providerSeedState,
  } from "./provider-seed.ts";
  import Run from "./run.svelte";
</script>

<RegistryProvider initialValues={[[providerSeedAtom, 1]]}>
  <HydrationBoundary state={providerSeedState}>
    <Run
      setup={() => {
        const value = useAtomValue(providerSeedAtom);
        return () => {
          if (BROWSER) {
            providerSeedSeen.push(value.current);
          }
          return value.current;
        };
      }}
    />
  </HydrationBoundary>
</RegistryProvider>
