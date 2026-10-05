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

/**
 * Enough of `EventSource` for the examples, reading server-sent events from the in-tab handler:
 * `open`, a `message` event with each event's data, and `error` when the request fails or the
 * stream ends. Unlike the browser's, it doesn't reconnect.
 */
class InTabEventSource extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  readyState: number = InTabEventSource.CONNECTING;
  readonly url: string;
  readonly withCredentials = false;
  readonly #abort = new AbortController();
  #reader: ReadableStreamDefaultReader<string> | undefined;

  constructor(url: string | URL) {
    super();
    this.url = new URL(url, inTabOrigin).href;
    void this.#connect();
  }

  close() {
    this.readyState = InTabEventSource.CLOSED;
    this.#abort.abort();
    void this.#cancel();
  }

  /** Stops the response's stream, which stops the handler sending events. */
  async #cancel() {
    try {
      await this.#reader?.cancel();
    } catch {
      // The stream had already failed; there is nothing left to stop.
    }
  }

  async #connect() {
    try {
      const response = await inTabFetch(this.url, {
        headers: { accept: "text/event-stream" },
        signal: this.#abort.signal,
      });
      if (!response.ok || !response.body || this.#closed()) {
        throw new Error(`GET ${this.url} answered ${response.status}`);
      }
      this.#reader = response.body
        .pipeThrough(new TextDecoderStream())
        .getReader();
      this.readyState = InTabEventSource.OPEN;
      this.dispatchEvent(new Event("open"));
      await this.#read(this.#reader, "");
    } catch {
      // Reported below, as the browser's EventSource reports a failed connection.
    }
    if (!this.#closed()) {
      this.readyState = InTabEventSource.CLOSED;
      this.dispatchEvent(new Event("error"));
    }
  }

  #closed() {
    return this.readyState === InTabEventSource.CLOSED;
  }

  /** Dispatches each complete event in the stream, keeping a partial one for the next chunk. */
  async #read(
    reader: ReadableStreamDefaultReader<string>,
    pending: string
  ): Promise<void> {
    const { done, value } = await reader.read();
    if (done || this.#closed()) {
      return;
    }
    const blocks = (pending + value).split("\n\n");
    const rest = blocks.pop() ?? "";
    for (const block of blocks) {
      const data = block
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice("data:".length).trimStart())
        .join("\n");
      this.dispatchEvent(new MessageEvent("message", { data }));
    }
    return this.#read(reader, rest);
  }
}

/**
 * In the hosted build, replaces the browser's `EventSource` with the stand-in that reads from the
 * in-tab API, which a network connection couldn't reach. The root layout calls it, so examples
 * use the global `EventSource` and their source works when pasted into an app.
 */
export const installInTabEventSource = (): void => {
  if (inTabApi && typeof window !== "undefined") {
    globalThis.EventSource =
      InTabEventSource as unknown as typeof globalThis.EventSource;
  }
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
