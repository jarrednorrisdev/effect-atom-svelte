import { Effect, Schema, Stream } from "effect";
import { AsyncResult, Atom } from "effect/reactivity";

/** Which atoms were computed in the browser, so a test can tell a seed from a fetch. */
export const unsentComputed: string[] = [];

/** What the stream atom's hook saw in the browser, in order. */
export const streamSeen: string[] = [];

export const resetUnsent = (): void => {
  unsentComputed.length = 0;
  streamSeen.length = 0;
};

const onServer = typeof window === "undefined";

/** A secret a defect on the server carries, which must not reach the page. */
export const serverSecret = "postgres://admin:hunter2@10.0.0.5";

/** Dies on the server with a message that must stay there; succeeds in the browser. */
export const defectAtom = Atom.make(
  Effect.suspend(() => {
    if (onServer) {
      return Effect.die(
        new Error(`connect ${serverSecret}`, {
          cause: new Error("inner-secret-detail"),
        })
      );
    }
    unsentComputed.push("defect");
    return Effect.succeed("defect from the browser");
  })
).pipe(
  Atom.serializable({
    key: "unsent-defect",
    schema: AsyncResult.Schema({ success: Schema.String }),
  })
);

/** On the server, a value its schema's check rejects, so it can't be encoded. */
export const unencodableAtom = Atom.make(
  Effect.sync((): string => {
    if (onServer) {
      return "x";
    }
    unsentComputed.push("unencodable");
    return "unencodable from the browser";
  })
).pipe(
  Atom.serializable({
    key: "unsent-unencodable",
    schema: AsyncResult.Schema({
      success: Schema.String.check(Schema.isMinLength(3)),
    }),
  })
);

/**
 * A stream that is still running when the server render ends, so the server sends its latest
 * value as waiting. In the browser it emits two values and ends.
 */
const stream: Stream.Stream<number> = onServer
  ? Stream.make(1, 2, 3).pipe(Stream.concat(Stream.never))
  : Stream.make(10, 20).pipe(Stream.tap(() => Effect.sleep("20 millis")));

// A stream atom's error includes NoSuchElementError, for a stream that ends without a value. This
// one never does, so its schema leaves it out.
export const streamAtom = (
  Atom.make(stream) as Atom.Atom<AsyncResult.AsyncResult<number>>
).pipe(
  Atom.serializable({
    key: "unsent-stream",
    schema: AsyncResult.Schema({ success: Schema.Number }),
  })
);
