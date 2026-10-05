import { Effect, Schedule, Stream } from "effect";
import { Atom } from "effect/reactivity";

import { EventLogState } from "#lib/docs/kit/event-log.svelte.ts";

// For the log under the example.
export const streamLog = new EventLogState({ limit: 8, separate: true });

// Counts the seconds since the stream started: 1 after a second, then 2, 3, …
// withServerValueInitial keeps it off the server, which would otherwise run it
// until the render ended.
export const clockAtom = Atom.make(
  // spaced emits 0, 1, 2, …, each a second after the last.
  Stream.fromSchedule(Schedule.spaced("1 second")).pipe(
    Stream.map((n) => n + 1),
    Stream.onStart(
      Effect.sync(() => streamLog.add("stream started", { tone: "running" }))
    ),
    // Runs when the stream stops: here, when the last reader goes away.
    Stream.ensuring(
      Effect.sync(() =>
        streamLog.add("stream stopped", { tone: "interrupted" })
      )
    )
  )
).pipe(Atom.withServerValueInitial);
