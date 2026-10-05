/**
 * The pretend weather API behind the suspense examples, kept out of their code: each load takes
 * 1.5 seconds, is logged under the getter example, and fails once after the failure example's
 * switch is turned on.
 */
import { Data, Effect } from "effect";

import { traced } from "./weather-log.ts";

export class WeatherUnavailable extends Data.TaggedError("WeatherUnavailable")<{
  readonly message: string;
}> {}

const forecasts: Record<string, string> = {
  Lima: "21 °C, misty",
  Paris: "18 °C, cloudy",
  Tokyo: "24 °C, sunny",
};

const load = (city: string) =>
  Effect.sleep("1500 millis").pipe(Effect.as(forecasts[city] ?? "No forecast"));

/** A city's forecast, logged under the getter example. */
export const fetchForecast = (city: string) => traced(city, load(city));

// Read by the load, which turns it off; the switch shows `failSwitch`, a copy for Svelte.
let failNext = false;
export const failSwitch = $state({ on: false });

export const setFailNext = (on: boolean) => {
  failNext = on;
  failSwitch.on = on;
};

/** A city's forecast, failing once after `setFailNext(true)`, as a flaky API would. */
export const fetchFlakyForecast = (city: string) =>
  Effect.gen(function* flakyLoad() {
    yield* Effect.sleep("1500 millis");
    if (failNext) {
      failNext = false;
      // A task of its own: the load ends while Svelte has an update in flight.
      setTimeout(() => (failSwitch.on = false), 0);
      return yield* new WeatherUnavailable({
        message: `No weather for ${city} right now`,
      });
    }
    return forecasts[city] ?? "No forecast";
  });
