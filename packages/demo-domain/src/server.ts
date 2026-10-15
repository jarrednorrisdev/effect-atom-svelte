import { Context, Duration, Effect, Layer, Schedule, Stream } from "effect";
import { HttpRouter, HttpServer, HttpServerResponse } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";
import { RpcSerialization, RpcServer } from "effect/rpc";

import { Account, DEMO_TOKEN, Unauthorized } from "./account.ts";
import { DemoApi } from "./http.ts";
import { TodosRpcs } from "./rpc.ts";
import {
  DuplicateTitle,
  TITLE_MAX_LENGTH,
  TitleTooLong,
  Todo,
  TodoNotFound,
} from "./todo.ts";

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
    readonly rename: (
      id: number,
      title: string
    ) => Effect.Effect<Todo, TodoNotFound | DuplicateTitle | TitleTooLong>;
    readonly toggle: (id: number) => Effect.Effect<Todo, TodoNotFound>;
    readonly remove: (id: number) => Effect.Effect<void, TodoNotFound>;
  }
>()("@demo/domain/server/TodoStore") {
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
      // Ids are never reused, so removing a todo can't make two share one.
      let nextId = todos.size + 1;
      const delay = Effect.delay(
        Duration.fromInputUnsafe(options.latency ?? 0)
      );
      const find = (id: number): Effect.Effect<Todo, TodoNotFound> => {
        const todo = todos.get(id);
        return todo === undefined
          ? Effect.fail(new TodoNotFound({ id }))
          : Effect.succeed(todo);
      };
      return TodoStore.of({
        create: Effect.fn("TodoStore.create")(function* create(title) {
          if (title.length > TITLE_MAX_LENGTH) {
            return yield* new TitleTooLong({ maxLength: TITLE_MAX_LENGTH });
          }
          const todo = new Todo({ done: false, id: nextId, title });
          nextId += 1;
          todos.set(todo.id, todo);
          return todo;
        }, delay),
        get: Effect.fn("TodoStore.get")(find, delay),
        list: Effect.fn("TodoStore.list")(
          (done) =>
            Effect.sync(() =>
              [...todos.values()].filter(
                (todo) => done === undefined || todo.done === done
              )
            ),
          delay
        ),
        remove: Effect.fn("TodoStore.remove")(function* remove(id) {
          yield* find(id);
          todos.delete(id);
        }, delay),
        rename: Effect.fn("TodoStore.rename")(function* rename(id, title) {
          const todo = yield* find(id);
          if (title.length > TITLE_MAX_LENGTH) {
            return yield* new TitleTooLong({ maxLength: TITLE_MAX_LENGTH });
          }
          const same = (other: string) =>
            other.trim().toLowerCase() === title.trim().toLowerCase();
          if (
            [...todos.values()].some(
              (other) => other.id !== id && same(other.title)
            )
          ) {
            return yield* new DuplicateTitle({ title });
          }
          const next = new Todo({ done: todo.done, id, title });
          todos.set(id, next);
          return next;
        }, delay),
        toggle: Effect.fn("TodoStore.toggle")(function* toggle(id) {
          const todo = yield* find(id);
          const next = new Todo({ done: !todo.done, id, title: todo.title });
          todos.set(id, next);
          return next;
        }, delay),
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
      removeTodo: ({ id }) => store.remove(id),
      renameTodo: ({ id, title }) => store.rename(id, title),
      ticks: ({ count }) =>
        Stream.fromSchedule(Schedule.spaced("500 millis")).pipe(
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
      remove: ({ params }) => store.remove(params.id),
      rename: ({ params, payload }) => store.rename(params.id, payload.title),
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
              message:
                (request.headers.authorization ?? "") === ""
                  ? "This route needs an Authorization header."
                  : "That token isn't valid.",
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
