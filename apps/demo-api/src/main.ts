import { makeDemoHandler } from "@demo/domain/server";
import { Config, Duration, Effect } from "effect";

const main = Effect.gen(function* main() {
  const port = yield* Config.Port("PORT").pipe(Config.withDefault(3010));
  // 400 ms keeps loading states visible in the demo; the e2e suite runs with 0.
  const latency = Duration.millis(
    yield* Config.Int("DEMO_LATENCY_MS").pipe(Config.withDefault(400))
  );

  let demo = makeDemoHandler({ latency });
  const reset = Effect.fn("reset")(function* reset() {
    const previous = demo;
    demo = makeDemoHandler({ latency });
    yield* Effect.promise(() => previous.dispose());
    return new Response(null, { status: 204 });
  });

  const runPromise = Effect.runPromiseWith(yield* Effect.context());
  Bun.serve({
    fetch: (request) => {
      // Puts the store back to its seed, so each e2e test starts from the same todos.
      // The docs' "Reset the demo API" button reaches it through the dev server's
      // /api proxy, as /api/__reset.
      const { pathname } = new URL(request.url);
      if (
        request.method === "POST" &&
        (pathname === "/__reset" || pathname === "/api/__reset")
      ) {
        return runPromise(reset());
      }
      return demo.handler(request);
    },
    port,
  });
  yield* Effect.log(
    `demo api on http://localhost:${port} (HTTP at /api/todos, RPC at /api/rpc)`
  );
});

Effect.runFork(
  main.pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => {
        process.exitCode = 1;
      }).pipe(Effect.andThen(Effect.logError(cause)))
    )
  )
);
