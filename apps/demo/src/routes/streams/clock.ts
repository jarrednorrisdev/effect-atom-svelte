import { Effect, Stream } from "effect";
import { Atom } from "effect/reactivity";

import { EventLogState } from "#lib/docs/kit/event-log.svelte.ts";

// For the log under the example.
export const streamLog = new EventLogState({ limit: 8, separate: true });

// Counts the seconds since the stream started. withServerValueInitial keeps it
// off the server, which would otherwise run it until the render ended.
export const clockAtom = Atom.make(
  Stream.tick("1 second").pipe(
    Stream.scan(() => 0, (n) => n + 1),
    Stream.onStart(
      Effect.sync(() => streamLog.add("stream started", { tone: "running" }))
    ),
    // Runs when the stream stops: here, when the last reader goes away.
    Stream.ensuring(
      Effect.sync(() => streamLog.add("stream stopped", { tone: "interrupted" }))
    )
  )
).pipe(Atom.withServerValueInitial);
