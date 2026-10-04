import { Context, Effect, Layer } from "effect";
import { Atom } from "effect/reactivity";

export class Weather extends Context.Service<
  Weather,
  { readonly today: Effect.Effect<string> }
>()("app/Weather") {}

// The real service calls a weather API.
const WeatherLive = Layer.succeed(Weather)({
  today: Effect.promise(async () => {
    const response = await fetch("/api/weather");
    return response.text();
  }),
});

export const runtime = Atom.runtime(WeatherLive);

export const forecastAtom = runtime.atom(
  Effect.gen(function* forecast() {
    const weather = yield* Weather;
    return `Today: ${yield* weather.today}`;
  })
);
