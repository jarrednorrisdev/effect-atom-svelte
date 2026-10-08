import { Effect, Schema } from "effect";
import { AsyncResult, Atom } from "effect/reactivity";

/** Which atoms were computed in the browser. */
export const skewComputed: string[] = [];

const onServer = typeof window === "undefined";

/**
 * A seed the server encodes but the browser can't decode, as when the schema the page was rendered
 * with differs from the one now loaded (a deploy between the two), or a schema whose decode is
 * stricter than its encode.
 */
const skewed = Schema.String.check(
  Schema.makeFilter(() => onServer, { title: "rendered on the server" })
);

export const skewAtom = Atom.make(
  Effect.sync((): string => {
    if (onServer) {
      return "skew from the server";
    }
    skewComputed.push("skew");
    return "skew from the browser";
  })
).pipe(
  Atom.serializable({
    key: "skew-seed",
    schema: AsyncResult.Schema({ success: skewed }),
  })
);
