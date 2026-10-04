import { browser } from "$app/env";
import { Effect, Schema } from "effect";
import { AsyncResult, Atom } from "effect/reactivity";

// Records where it ran.
const where = Effect.sync((): string => (browser ? "browser" : "server")).pipe(
  Effect.delay("500 millis")
);
const schema = AsyncResult.Schema({ success: Schema.String });

export const pricesAtom = Atom.make(where).pipe(
  Atom.serializable({ key: "prices", schema })
);

// The same, wrapped to run again when the "prices" reactivity key is invalidated.
export const pricesWithKeysAtom = Atom.make(where).pipe(
  Atom.withReactivity(["prices"]),
  Atom.serializable({ key: "prices-with-keys", schema })
);
