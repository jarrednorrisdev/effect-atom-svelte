import { Effect, Layer } from "effect";
import { FetchHttpClient, HttpClient } from "effect/http";

/**
 * The hosted site has no demo API server. Built with `VITE_DEMO_API=in-tab`, the clients send
 * their requests to the demo API's handler running in the same JavaScript context instead: in the
 * visitor's tab, and in the build when it prerenders a page. Dev and the e2e suite use the real
 * servers.
 */
export const inTabApi = import.meta.env.VITE_DEMO_API === "in-tab";

/** Requests never leave the page, so any absolute origin works; `.invalid` can never resolve. */
export const inTabOrigin = "http://demo-api.invalid";

type Handler = (request: Request) => Promise<Response>;

const loadHandler = async (): Promise<Handler> => {
  const { makeDemoHandler } = await import("@demo/domain/server");
  // 400 ms, like the dev API, so loading states are visible.
  return makeDemoHandler({ latency: "400 millis" }).handler;
};

let handler: Promise<Handler> | undefined;

// Loaded on the first request, so the server code only reaches the hosted build's pages that use
// the API. Each tab gets its own store, starting from the seed todos.
const inTabFetch: typeof fetch = async (input, init) => {
  handler ??= loadHandler();
  const handle = await handler;
  return handle(new Request(input, init));
};

/** An `HttpClient` that sends every request to the in-tab handler instead of the network. */
export const inTabHttpClient: Layer.Layer<HttpClient.HttpClient> = Layer.effect(
  HttpClient.HttpClient,
  Effect.gen(function* makeInTabHttpClient() {
    const client = yield* HttpClient.HttpClient;
    return HttpClient.transform(client, (response) =>
      Effect.provideService(response, FetchHttpClient.Fetch, inTabFetch)
    );
  })
).pipe(Layer.provide(FetchHttpClient.layer));
