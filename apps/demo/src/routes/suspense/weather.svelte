<script module lang="ts">
  import { Atom } from "effect/reactivity";

  // fetchForecast takes 1.5 seconds, and adds each load to the log below.
  import { fetchForecast } from "./weather-api.svelte.ts";

  // One atom per city, loaded in the browser only.
  const weatherAtom = Atom.family((city: string) =>
    Atom.make(fetchForecast(city)).pipe(Atom.withServerValueInitial)
  );
</script>

<script lang="ts">
  import { useAtomSuspense } from "effect-atom-svelte";
  import BoundaryFrame from "#lib/docs/kit/boundary-frame.svelte";
  import EventLog from "#lib/docs/kit/event-log.svelte";

  import { loads } from "./weather-log.ts";

  let city = $state("Paris");

  // A getter: the boundary awaits whichever city is picked.
  const weather = useAtomSuspense(() => weatherAtom(city));
</script>

<div aria-label="City" class="flex gap-2" role="group">
  {#each ["Paris", "Tokyo", "Lima"] as name (name)}
    <button aria-pressed={city === name} onclick={() => (city = name)}>
      {name}
    </button>
  {/each}
</div>

<!-- data-branch and data-updating tell the inspector below what rendered. -->
<div class="mt-4">
  <BoundaryFrame>
    <svelte:boundary>
      <div data-branch="content">
        <p class="m-0 text-lg font-semibold">{city}</p>
        <p class="m-0" data-testid="weather">{await weather.current}</p>
        {#if $effect.pending() > 0}
          <p
            class="m-0 text-sm text-muted-foreground"
            data-updating={$effect.pending()}
          >
            Updating…
          </p>
        {/if}
      </div>

      {#snippet pending()}
        <p class="m-0" data-branch="pending">Loading the weather…</p>
      {/snippet}
    </svelte:boundary>
  </BoundaryFrame>
</div>
<EventLog
  empty="Nothing loaded yet."
  entries={loads.entries}
  label="Loads"
  max={8}
/>
