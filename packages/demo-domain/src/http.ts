import { Schema } from "effect";
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/http-api";

import { Account, Unauthorized } from "./account.ts";
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

/** One route that needs a header: `Authorization: Bearer demo-token`, or a typed 401. */
export class AccountApiGroup extends HttpApiGroup.make("account").add(
  HttpApiEndpoint.get("me", "/me", { error: Unauthorized, success: Account })
) {}

export class DemoApi extends HttpApi.make("demo")
  .add(TodosApiGroup)
  .add(AccountApiGroup)
  .prefix("/api") {}
