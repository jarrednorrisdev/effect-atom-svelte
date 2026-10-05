import { Schema } from "effect";

export const TITLE_MAX_LENGTH = 60;

/** The demo API starts with todos 1 and 2; anything with a higher id was added by a visitor. */
export const isAddedTodo = (todo: { readonly id: number }) => todo.id > 2;

export class Todo extends Schema.Class<Todo>("Todo")({
  done: Schema.Boolean,
  id: Schema.Int,
  title: Schema.String,
}) {}

export class TodoNotFound extends Schema.TaggedError<TodoNotFound>()(
  "TodoNotFound",
  { id: Schema.Int },
  { httpApiStatus: 404 }
) {}

export class TitleTooLong extends Schema.TaggedError<TitleTooLong>()(
  "TitleTooLong",
  { maxLength: Schema.Int },
  { httpApiStatus: 422 }
) {}
