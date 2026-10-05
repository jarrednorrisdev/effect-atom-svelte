import { Effect, Layer } from "effect";
import { HttpClient } from "effect/http";

import { httpClient } from "#lib/clients.ts";
import { EventLogState } from "#lib/docs/kit/event-log.svelte.ts";

/** What transform.svelte's client sent and got back, for the log under the example. */
export const wire = new EventLogState();

/**
 * The demo's HTTP client, logging each request and its status. It logs after `transformClient`
 * has changed the request, so the log shows the header the example adds.
 */
export const loggedHttpClient: Layer.Layer<HttpClient.HttpClient> =
  Layer.effect(
    HttpClient.HttpClient,
    Effect.gen(function* makeLoggedHttpClient() {
      const client = yield* HttpClient.HttpClient;
      return HttpClient.transform(
        client,
        (response, { headers, method, url }) =>
          Effect.suspend(() => {
            const path = new URL(url, location.href).pathname;
            wire.add(`${method} ${path}, x-reader: ${headers["x-reader"]}`, {
              tone: "running",
            });
            return Effect.tap(response, ({ status }) =>
              Effect.sync(() =>
                wire.add(`${status}`, {
                  tone: status < 400 ? "success" : "failure",
                })
              )
            );
          })
      );
    })
  ).pipe(Layer.provide(httpClient));
