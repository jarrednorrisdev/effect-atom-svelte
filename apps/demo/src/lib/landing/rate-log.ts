import { EventLogState } from "#lib/docs/kit/event-log.svelte.ts";

// The log under example 01: each run of rateAtom's effect. Kept out of exchange-rate.ts, whose
// source the example shows.
export const runs = new EventLogState({ limit: 6 });
