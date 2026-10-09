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
