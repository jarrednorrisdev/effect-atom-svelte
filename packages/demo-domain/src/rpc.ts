import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";

import { TitleTooLong, Todo, TodoNotFound } from "./todo.ts";

export class TodosRpcs extends RpcGroup.make(
  Rpc.make("listTodos", { success: Schema.Array(Todo) }),
  Rpc.make("getTodo", {
    error: TodoNotFound,
    payload: { id: Schema.Int },
    success: Todo,
  }),
  Rpc.make("createTodo", {
    error: TitleTooLong,
    payload: { title: Schema.String },
    success: Todo,
  }),
  Rpc.make("toggleTodo", {
    error: TodoNotFound,
    payload: { id: Schema.Int },
    success: Todo,
  }),
  Rpc.make("ticks", {
    payload: { count: Schema.Int },
    stream: true,
    success: Schema.Int,
  })
) {}
