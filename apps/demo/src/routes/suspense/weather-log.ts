import { Effect } from "effect";

import { EventLogState } from "#lib/docs/kit/event-log.svelte.ts";
import type { Tone } from "#lib/docs/kit/tone.ts";

/** Each city's loads, for the log under the boundary example. Not part of its code. */
export const loads = new EventLogState();

// Logged from a fresh task: a load runs while Svelte has an update in flight, and
// writing to the log's state then breaks Svelte's batching.
const log = (label: string, tone: Tone) =>
  Effect.sync(() => {
    setTimeout(() => loads.add(label, { tone }), 0);
  });

/** Logs when a city's load starts, and how it ends: loaded, failed or interrupted. */
export const traced = <A, E>(city: string, load: Effect.Effect<A, E>) =>
  log(`${city}: loading`, "running").pipe(
    Effect.andThen(load),
    Effect.tap(() => log(`${city}: loaded`, "success")),
    Effect.tapError(() => log(`${city}: failed`, "failure")),
    Effect.onInterrupt(() => log(`${city}: interrupted`, "interrupted"))
  );
