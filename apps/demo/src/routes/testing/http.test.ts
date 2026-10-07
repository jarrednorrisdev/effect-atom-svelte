import { DemoApi, Todo } from "@demo/domain";
import { Effect, Layer } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import { HttpApiClient } from "effect/http-api";
import { AtomRegistry } from "effect/reactivity";
import { expect, test } from "vitest";

import { TodosHttp } from "#lib/clients.ts";

// An HttpClient that answers every request itself, without a network.
const respondWith = (body: unknown, status = 200) =>
  Layer.succeed(HttpClient.HttpClient)(
    HttpClient.make((request) =>
      Effect.succeed(
        HttpClientResponse.fromWeb(request, Response.json(body, { status }))
      )
    )
  );

// The real client class, built from the API definition over the fake HttpClient.
const TodosHttpTest = (body: unknown, status?: number) =>
  Layer.effect(TodosHttp)(
    HttpApiClient.make(DemoApi, { baseUrl: "http://test.invalid" })
  ).pipe(Layer.provide(respondWith(body, status)));

test("a query decodes the response", async () => {
  const registry = AtomRegistry.make({
    initialValues: [
      [
        TodosHttp.runtime.layer,
        TodosHttpTest([{ done: true, id: 1, title: "Write tests" }]),
      ],
    ],
  });

  const todos = await Effect.runPromise(
    AtomRegistry.getResult(
      registry,
      TodosHttp.query("todos", "list", { query: {} })
    )
  );
  expect(todos).toEqual([
    new Todo({ done: true, id: 1, title: "Write tests" }),
  ]);
});

test("an error response fails with the endpoint's typed error", async () => {
  const registry = AtomRegistry.make({
    initialValues: [
      [
        TodosHttp.runtime.layer,
        TodosHttpTest({ _tag: "TodoNotFound", id: 99 }, 404),
      ],
    ],
  });

  const error = await Effect.runPromise(
    AtomRegistry.getResult(
      registry,
      TodosHttp.query("todos", "get", { params: { id: 99 } })
    ).pipe(Effect.flip)
  );
  expect(error._tag).toBe("TodoNotFound");
});
