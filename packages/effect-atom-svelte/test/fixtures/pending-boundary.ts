import { Effect, Schema } from "effect";
import { AsyncResult, Atom } from "effect/reactivity";

/** Where the atom was computed, so a test can tell whether the server ran it (JND-86). */
export const pendingBoundaryComputed: string[] = [];

/** A serializable atom read inside a boundary whose pending snippet the server renders. */
export const pendingBoundaryAtom = Atom.make(
  Effect.sync((): string => {
    const where = typeof window === "undefined" ? "server" : "browser";
    pendingBoundaryComputed.push(where);
    return `from the ${where}`;
  }).pipe(Effect.delay("20 millis"))
).pipe(
  Atom.serializable({
    key: "pending-boundary",
    schema: AsyncResult.Schema({ success: Schema.String }),
  })
);
