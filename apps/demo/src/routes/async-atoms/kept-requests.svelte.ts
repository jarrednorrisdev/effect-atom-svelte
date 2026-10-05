import { Effect } from "effect";

/**
 * The pretend requests behind the "Keeping results" example, and how many times each has run,
 * for the cards under it. Not part of the example's code.
 */
export const runs = $state({ search: 0, settings: 0, weather: 0 });

/** A request that takes a moment, and counts each time it runs. */
export const request = (name: keyof typeof runs, value: string) =>
  Effect.sync(() => {
    // Counted in a task of its own: the atom can run while Svelte has an update in flight.
    setTimeout(() => {
      runs[name] += 1;
    }, 0);
  }).pipe(
    Effect.andThen(Effect.succeed(value).pipe(Effect.delay("1500 millis")))
  );
