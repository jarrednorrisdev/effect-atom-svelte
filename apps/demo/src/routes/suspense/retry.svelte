<script module lang="ts">
  import { Atom } from "effect/reactivity";

  // fetchFlakyForecast takes 1.5 seconds, and fails once Fail the next load is on.
  import { fetchFlakyForecast } from "./weather-api.svelte.ts";

  // Loaded in the browser only, so the page opens on the pending snippet.
  const forecastAtom = Atom.make(fetchFlakyForecast("Paris")).pipe(
    Atom.withServerValueInitial
  );
</script>

<script lang="ts">
  import { useAtomRefresh, useAtomSuspense } from "effect-atom-svelte";
  import BoundaryFrame from "#lib/docs/kit/boundary-frame.svelte";

  import FailSwitch from "./fail-switch.svelte";

  // suspendOnWaiting: after a refresh, the content waits for the new result.
  const forecast = useAtomSuspense(forecastAtom, { suspendOnWaiting: true });
  const refresh = useAtomRefresh(forecastAtom);
</script>

<div class="flex flex-wrap items-center gap-2">
  <FailSwitch />
  <button onclick={refresh}>Reload</button>
</div>

<!-- data-branch tells the inspector below which branch rendered. -->
<div class="mt-4">
  <BoundaryFrame>
    <svelte:boundary>
      <p class="m-0" data-branch="content" data-testid="retry-forecast">
        {await forecast.current}
      </p>

      {#snippet pending()}
        <p class="m-0" data-branch="pending">Loading Paris's forecast…</p>
      {/snippet}

      {#snippet failed(error, reset)}
        <div data-branch="failed">
          <!-- App.Error: SvelteKit's error type, what handleError returns. -->
          <p class="m-0" data-testid="retry-failed">{(error as App.Error).message}</p>
          <button
            onclick={() => {
              refresh();
              reset();
            }}
          >
            Try again
          </button>
        </div>
      {/snippet}
    </svelte:boundary>
  </BoundaryFrame>
</div>
