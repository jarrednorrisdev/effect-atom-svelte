import { Schema } from "effect";

export const TITLE_MAX_LENGTH = 60;

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
