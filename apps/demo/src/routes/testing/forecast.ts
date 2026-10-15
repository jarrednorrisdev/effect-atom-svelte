import { Context, Effect, Layer } from "effect";
import { FetchHttpClient, HttpClient } from "effect/http";
import { Atom } from "effect/reactivity";

export class Weather extends Context.Service<
  Weather,
  { readonly today: Effect.Effect<string> }
>()("app/Weather") {}

// The real service calls a weather API.
const WeatherLayer = Layer.effect(Weather)(
  Effect.gen(function* makeWeather() {
    const client = yield* HttpClient.HttpClient;
    return {
      today: client.get("/api/weather").pipe(
        Effect.flatMap((response) => response.text),
        Effect.orDie
      ),
    };
  })
).pipe(Layer.provide(FetchHttpClient.layer));

export const runtime = Atom.runtime(WeatherLayer);

export const forecastAtom = runtime.atom(
  Effect.gen(function* forecast() {
    const weather = yield* Weather;
    return `Today: ${yield* weather.today}`;
  })
);
