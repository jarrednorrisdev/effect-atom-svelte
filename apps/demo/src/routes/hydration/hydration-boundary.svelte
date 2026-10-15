<script lang="ts">
  import { HydrationBoundary } from "effect-atom-svelte";

  import { pricesState } from "./prices.remote.ts";
  import Prices from "./prices.svelte";
</script>

<!-- Its result came with the page, so the browser doesn't call it again. -->
<HydrationBoundary state={await pricesState()}>
  <Prices />
</HydrationBoundary>
