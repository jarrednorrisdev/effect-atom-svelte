import { Effect, Layer } from "effect";
import { AtomRegistry } from "effect/reactivity";
import { expect, test } from "vitest";

import { forecastAtom, runtime, Weather } from "./forecast.ts";

const WeatherTest = Layer.succeed(Weather)({ today: Effect.succeed("Sunny") });

test("the forecast comes from the test layer", async () => {
  // runtime.layer is the atom holding the runtime's Layer: give it another.
  const registry = AtomRegistry.make({
    initialValues: [[runtime.layer, WeatherTest]],
  });

  const forecast = await Effect.runPromise(
    AtomRegistry.getResult(registry, forecastAtom)
  );
  expect(forecast).toBe("Today: Sunny");
});
