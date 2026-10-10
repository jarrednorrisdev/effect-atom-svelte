import { Effect, Schema } from "effect";
import { AsyncResult, Atom } from "effect/reactivity";

import { ScopedAtom } from "../../src/index.ts";

/** Which scoped atoms were computed in this environment, so a test can tell a seed from a fetch. */
export const scopedComputed: string[] = [];

/** A serializable scoped atom with its input in the key, as the docs advise. */
export const ScopedUser = ScopedAtom.make(
  (id: string) =>
    Atom.make(() => {
      scopedComputed.push(id);
      const where = typeof window === "undefined" ? "server" : "browser";
      return Effect.succeed(`${id} from the ${where}`).pipe(
        Effect.delay("20 millis")
      );
    }).pipe(
      Atom.serializable({
        key: `scoped-user-${id}`,
        schema: AsyncResult.Schema({ success: Schema.String }),
      })
    ),
  { name: "ScopedUser" }
);

/** Which family atoms were computed in this environment, as scopedComputed. */
export const familyComputed: string[] = [];

/** One serializable atom per user id, wherever it's asked for. */
export const userFamily = Atom.family((id: string) =>
  Atom.make(() => {
    familyComputed.push(id);
    const where = typeof window === "undefined" ? "server" : "browser";
    return Effect.succeed(`${id} from the ${where}`).pipe(
      Effect.delay("20 millis")
    );
  }).pipe(
    Atom.serializable({
      key: `family-user-${id}`,
      schema: AsyncResult.Schema({ success: Schema.String }),
    })
  )
);

/** A scoped atom that provides the family's atom, as the docs advise for a value from the server. */
export const FamilyUser = ScopedAtom.make((id: string) => userFamily(id), {
  name: "FamilyUser",
});
