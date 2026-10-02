import { Effect, Layer, Schema } from "effect";
import { AsyncResult, Atom } from "effect/reactivity";

/** How often the query was fetched in this environment, so a test can tell a seed from a fetch. */
export const queryFetches = { count: 0 };

/**
 * A serializable query wrapped by `withReactivity`, as `AtomRpc.query` and `AtomHttpApi.query`
 * build it for `reactivityKeys`. The registry seeds the inner atom for these (JND-19).
 */
export const reactiveQuery = Atom.make(
  Effect.sync(() => {
    queryFetches.count += 1;
    // The server's count carries over between renders, so only the browser's is shown.
    return typeof window === "undefined"
      ? "server"
      : `browser ${queryFetches.count}`;
  }).pipe(Effect.delay("20 millis"))
).pipe(
  Atom.withReactivity(["reactive"]),
  Atom.serializable({
    key: "reactive-query",
    schema: AsyncResult.Schema({ success: Schema.String }),
  })
);

/** A mutation that invalidates the query's reactivity key. */
export const mutate = Atom.runtime(Layer.empty).fn(() => Effect.void, {
  reactivityKeys: ["reactive"],
});
