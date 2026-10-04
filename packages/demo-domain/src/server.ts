import { Context, Duration, Effect, Layer, Schedule, Stream } from "effect";
import { HttpRouter, HttpServer, HttpServerResponse } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";
import { RpcSerialization, RpcServer } from "effect/rpc";

import { Account, DEMO_TOKEN, Unauthorized } from "./account.ts";
import { DemoApi } from "./http.ts";
import { TodosRpcs } from "./rpc.ts";
import { TITLE_MAX_LENGTH, TitleTooLong, Todo, TodoNotFound } from "./todo.ts";

export interface ServerOptions {
  /** Added to every handler so loading and refresh states are visible. */
  readonly latency?: Duration.Input | undefined;
}

class TodoStore extends Context.Service<
  TodoStore,
  {
    readonly list: (done?: boolean) => Effect.Effect<readonly Todo[]>;
    readonly get: (id: number) => Effect.Effect<Todo, TodoNotFound>;
    readonly create: (title: string) => Effect.Effect<Todo, TitleTooLong>;
    readonly toggle: (id: number) => Effect.Effect<Todo, TodoNotFound>;
  }
>()("demo/TodoStore") {
  static readonly layer = (options: ServerOptions) =>
    Layer.sync(TodoStore, () => {
      const todos = new Map<number, Todo>([
        [
          1,
          new Todo({
            done: false,
            id: 1,
            title: "Read the Effect Atom source",
          }),
        ],
        [2, new Todo({ done: true, id: 2, title: "Write a Svelte adapter" })],
      ]);
      const delay = Effect.delay(
        Duration.fromInputUnsafe(options.latency ?? 0)
      );
      const find = (id: number): Effect.Effect<Todo, TodoNotFound> => {
        const todo = todos.get(id);
        return todo
          ? Effect.succeed(todo)
          : Effect.fail(new TodoNotFound({ id }));
      };
      return TodoStore.of({
        create: (title) =>
          (title.length > TITLE_MAX_LENGTH
            ? Effect.fail(new TitleTooLong({ maxLength: TITLE_MAX_LENGTH }))
            : Effect.sync(() => {
                const todo = new Todo({
                  done: false,
                  id: todos.size + 1,
                  title,
                });
                todos.set(todo.id, todo);
                return todo;
              })
          ).pipe(delay),
        get: (id) => find(id).pipe(delay),
        list: (done) =>
          Effect.sync(() =>
            [...todos.values()].filter(
              (todo) => done === undefined || todo.done === done
            )
          ).pipe(delay),
        toggle: (id) =>
          find(id).pipe(
            Effect.map((todo) => {
              const next = new Todo({ ...todo, done: !todo.done });
              todos.set(id, next);
              return next;
            }),
            delay
          ),
      });
    });
}

const RpcHandlers = TodosRpcs.toLayer(
  Effect.gen(function* makeRpcHandlers() {
    const store = yield* TodoStore;
    return TodosRpcs.of({
      createTodo: ({ title }) => store.create(title),
      getTodo: ({ id }) => store.get(id),
      listTodos: () => store.list(),
      ticks: ({ count }) =>
        Stream.fromSchedule(Schedule.spaced("200 millis")).pipe(
          Stream.take(count)
        ),
      toggleTodo: ({ id }) => store.toggle(id),
    });
  })
);

const HttpHandlers = HttpApiBuilder.group(DemoApi, "todos", (handlers) =>
  Effect.gen(function* makeHttpHandlers() {
    const store = yield* TodoStore;
    return handlers.handleAll({
      create: ({ payload }) => store.create(payload.title),
      get: ({ params }) => store.get(params.id),
      list: ({ query }) =>
        store.list(
          query.done === undefined ? undefined : query.done === "true"
        ),
      toggle: ({ params }) => store.toggle(params.id),
    });
  })
);

// GET /api/me answers only with the demo token, so a client has to add the header itself.
const accountHandlers = (options: ServerOptions) =>
  HttpApiBuilder.group(DemoApi, "account", (handlers) =>
    handlers.handle("me", ({ request }) =>
      (request.headers.authorization === `Bearer ${DEMO_TOKEN}`
        ? Effect.succeed(new Account({ name: "Ada" }))
        : Effect.fail(
            new Unauthorized({
              message: request.headers.authorization
                ? "That token isn't valid."
                : "This route needs an Authorization header.",
            })
          )
      ).pipe(Effect.delay(Duration.fromInputUnsafe(options.latency ?? 0)))
    )
  );

const encoder = new TextEncoder();

/**
 * Server-sent events at GET /api/events: a numbered message every 600 milliseconds, starting at
 * 1 for each connection, until the client disconnects.
 */
const EventsRoute = HttpRouter.add(
  "GET",
  "/api/events",
  Effect.sync(() =>
    HttpServerResponse.stream(
      Stream.fromSchedule(Schedule.spaced("600 millis")).pipe(
        Stream.map((n) => encoder.encode(`data: ${n + 1}\n\n`))
      ),
      {
        contentType: "text/event-stream",
        headers: { "cache-control": "no-cache" },
      }
    )
  )
);

/**
 * Serves the demo API over HTTP at /api/todos and /api/me, RPC at /api/rpc and server-sent events
 * at /api/events, from one in-memory store.
 */
export const makeDemoHandler = (options: ServerOptions = {}) =>
  HttpRouter.toWebHandler(
    Layer.mergeAll(
      HttpApiBuilder.layer(DemoApi).pipe(
        Layer.provide([HttpHandlers, accountHandlers(options)])
      ),
      EventsRoute,
      RpcServer.layerHttp({
        group: TodosRpcs,
        path: "/api/rpc",
        protocol: "http",
      }).pipe(
        Layer.provide(RpcHandlers),
        Layer.provide(RpcSerialization.layerNdjson)
      )
    ).pipe(Layer.provide([TodoStore.layer(options), HttpServer.layerServices])),
    { disableLogger: true }
  );
