<script module lang="ts">
  import { Data, Effect } from "effect";
  import { Atom } from "effect/reactivity";

  import { traced } from "./weather-log.ts";

  class WeatherUnavailable extends Data.TaggedError("WeatherUnavailable")<{
    readonly message: string;
  }> {}

  const forecasts: Record<string, string> = {
    Lima: "21 °C, misty",
    Paris: "18 °C, cloudy",
    Tokyo: "24 °C, sunny",
  };

  // The example's switch: the next load fails, as a flaky API would.
  let failNext = false;

  // One atom per city. Each load takes 1.5 seconds, in the browser only, so
  // the page opens on the boundary's pending snippet.
  const weatherAtom = Atom.family((city: string) =>
    Atom.make(
      traced(
        city,
        Effect.gen(function* loadForecast() {
          yield* Effect.sleep("1500 millis");
          if (failNext) {
            failNext = false;
            return yield* new WeatherUnavailable({
              message: `No weather for ${city} right now`,
            });
          }
          return forecasts[city] ?? "No forecast";
        })
      )
    ).pipe(Atom.withServerValueInitial)
  );
</script>

<script lang="ts">
  import { useAtomRefresh, useAtomSuspense } from "effect-atom-svelte";
  import BoundaryFrame from "#lib/docs/kit/boundary-frame.svelte";
  import EventLog from "#lib/docs/kit/event-log.svelte";

  import { loads } from "./weather-log.ts";

  let city = $state("Paris");
  let fail = $state(false);

  // A getter: the boundary awaits whichever city is picked. suspendOnWaiting
  // makes a reload wait for the new forecast, so Try again shows it.
  const weather = useAtomSuspense(() => weatherAtom(city), {
    suspendOnWaiting: true,
  });
  const reload = useAtomRefresh(() => weatherAtom(city));

  const toggleFail = () => {
    fail = !fail;
    failNext = fail;
  };
  // The failed snippet's retry: load again, then render the content again.
  const retry = (reset: () => void) => {
    fail = false;
    reload();
    reset();
  };
</script>

<div class="flex flex-wrap items-center gap-2">
  <div aria-label="City" class="flex gap-2" role="group">
    {#each ["Paris", "Tokyo", "Lima"] as name (name)}
      <button aria-pressed={city === name} onclick={() => (city = name)}>
        {name}
      </button>
    {/each}
  </div>
  <button onclick={reload}>Reload</button>
  <button aria-pressed={fail} onclick={toggleFail}>Fail the next load</button>
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

      {#snippet failed(error, reset)}
        <div data-branch="failed">
          <p class="m-0" data-testid="weather-failed">
            {(error as App.Error).message}
          </p>
          <button onclick={() => retry(reset)}>Try again</button>
        </div>
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
