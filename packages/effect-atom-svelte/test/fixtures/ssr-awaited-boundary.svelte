<!-- A HydrationBoundary whose state is awaited in markup, around a query with reactivity keys:
     the hydrated query builds its outer atom as it is first read (JND-95). -->
<script lang="ts">
  import { hydratable } from "svelte";

  import { HydrationBoundary, RegistryProvider } from "../../src/index.ts";
  import { dehydratedQuery } from "./awaited-boundary.ts";
  import AwaitedBoundaryReader from "./awaited-boundary-reader.svelte";

  const state = () => hydratable("awaited-boundary-state", dehydratedQuery);
</script>

<RegistryProvider>
  <HydrationBoundary state={await state()}>
    <AwaitedBoundaryReader />
  </HydrationBoundary>
</RegistryProvider>
