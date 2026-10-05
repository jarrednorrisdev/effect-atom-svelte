<script module lang="ts">
  import { Effect } from "effect";
  import { Atom } from "effect/reactivity";

  // Takes 1.5 seconds, as a request would.
  const forecastAtom = Atom.make(
    Effect.succeed("18 °C, cloudy").pipe(Effect.delay("1500 millis"))
  );
</script>

<script lang="ts">
  import { useAtomSuspense } from "effect-atom-svelte";
  import BoundaryFrame from "#lib/docs/kit/boundary-frame.svelte";

  const forecast = useAtomSuspense(forecastAtom);
</script>

<!-- data-branch tells the inspector below which branch rendered. -->
<BoundaryFrame>
  <svelte:boundary>
    <p class="m-0" data-branch="content" data-testid="forecast">
      {await forecast.current}
    </p>

    {#snippet pending()}
      <p class="m-0" data-branch="pending">Loading the forecast…</p>
    {/snippet}
  </svelte:boundary>
</BoundaryFrame>
