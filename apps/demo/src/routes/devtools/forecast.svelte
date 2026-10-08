<script module lang="ts">
  import { Data, Effect } from "effect";
  import { Atom } from "effect/reactivity";

  class CityNotFound extends Data.TaggedError("CityNotFound")<{
    readonly city: string;
  }> {}

  const forecasts: Record<string, string> = {
    London: "14 °C, drizzle",
    Paris: "19 °C, sunny",
    Tokyo: "23 °C, humid",
  };

  const cityAtom = Atom.make("London");

  // Runs again whenever cityAtom changes, interrupting a load still running.
  const forecastAtom = Atom.make((get) => {
    const city = get(cityAtom);
    return Effect.gen(function* loadForecast() {
      yield* Effect.sleep("1500 millis");
      const forecast = forecasts[city];
      if (forecast === undefined) {
        return yield* new CityNotFound({ city });
      }
      return forecast;
    });
  });
</script>

<script lang="ts">
  import { useAtom, useAtomValue } from "effect-atom-svelte";
  import CauseView from "#lib/docs/kit/cause-view.svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  const city = useAtom(cityAtom);
  const forecast = useAtomValue(forecastAtom);
</script>

<div aria-label="City" class="flex flex-wrap gap-2" role="group">
  {#each ["London", "Paris", "Tokyo", "Atlantis"] as option (option)}
    <button
      aria-pressed={city.current === option}
      onclick={() => (city.current = option)}
    >
      {option}
    </button>
  {/each}
</div>
<div class="mt-3 flex flex-wrap items-baseline gap-4">
  {#if forecast.current._tag === "Success"}
    <ResultChip
      busy={forecast.current.waiting}
      kind="message"
      label="forecastAtom"
      tone="success"
    >
      <span data-testid="forecast">{forecast.current.value}</span>
    </ResultChip>
  {:else if forecast.current._tag === "Failure"}
    <div aria-busy={forecast.current.waiting}>
      <CauseView
        cause={forecast.current.cause}
        code
        data-testid="forecast-failure"
        label="forecastAtom"
      />
    </div>
  {:else}
    <ResultChip kind="message" label="forecastAtom" tone="running">
      Loading…
    </ResultChip>
  {/if}
  <StateBadge data-testid="forecast-state" result={forecast.current} />
</div>
