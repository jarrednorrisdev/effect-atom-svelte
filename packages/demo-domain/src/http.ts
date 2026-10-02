import { Schema } from "effect";
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/http-api";

import { TitleTooLong, Todo, TodoNotFound } from "./todo.ts";

export class TodosApiGroup extends HttpApiGroup.make("todos")
  .add(
    HttpApiEndpoint.get("list", "/", {
      query: { done: Schema.optional(Schema.Literals(["true", "false"])) },
      success: Schema.Array(Todo),
    }),
    HttpApiEndpoint.get("get", "/:id", {
      error: TodoNotFound,
      params: { id: Schema.NumberFromString },
      success: Todo,
    }),
    HttpApiEndpoint.post("create", "/", {
      error: TitleTooLong,
      payload: Schema.Struct({ title: Schema.String }),
      success: Todo,
    }),
    HttpApiEndpoint.patch("toggle", "/:id/toggle", {
      error: TodoNotFound,
      params: { id: Schema.NumberFromString },
      success: Todo,
    })
  )
  .prefix("/todos") {}

export class DemoApi extends HttpApi.make("demo")
  .add(TodosApiGroup)
  .prefix("/api") {}
