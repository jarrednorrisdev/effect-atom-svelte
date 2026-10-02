import { Effect, Schema } from "effect";
import { AsyncResult, Atom } from "effect/reactivity";

/** Which list atoms were computed in this environment, so a test can tell a seed from a fetch. */
export const computed: string[] = [];

export const filterAtom = Atom.make("a");

export const listFor = Atom.family((filter: string) =>
  Atom.make(() => {
    computed.push(filter);
    const where = typeof window === "undefined" ? "server" : "browser";
    return Effect.succeed(`${filter} from the ${where}`).pipe(
      Effect.delay("20 millis")
    );
  }).pipe(
    Atom.serializable({
      key: `seeded-list-${filter}`,
      schema: AsyncResult.Schema({ success: Schema.String }),
    })
  )
);
