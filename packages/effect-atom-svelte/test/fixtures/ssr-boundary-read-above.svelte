<!-- A layout reading an atom above a page's HydrationBoundary that hydrates the same atom. -->
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

<RegistryProvider>
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
          if (BROWSER) {
            providerSeedSeen.push(value.current);
          }
          return value.current;
        };
      }}
    />
  </HydrationBoundary>
</RegistryProvider>
