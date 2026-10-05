import { Data, Effect } from "effect";

export class TitleTooLong extends Data.TaggedError("TitleTooLong")<{
  readonly maxLength: number;
}> {}

export interface Todo {
  readonly done: boolean;
  readonly id: number;
  readonly title: string;
}

// A pretend API for this page's examples, kept in memory. Each request
// takes a moment, as a real one would.
const saved: Todo[] = [
  { done: false, id: 1, title: "Read the Effect Atom source" },
  { done: true, id: 2, title: "Write a Svelte adapter" },
];

export const listTodos = Effect.sync(() => [...saved]).pipe(
  Effect.delay("500 millis")
);

export const createTodo = (title: string) =>
  Effect.gen(function* create() {
    yield* Effect.sleep("1 second");
    if (title.length > 60) {
      return yield* new TitleTooLong({ maxLength: 60 });
    }
    const todo = { done: false, id: saved.length + 1, title };
    saved.push(todo);
    return todo;
  });

export const toggleTodo = (id: number) =>
  Effect.sync(() => {
    const index = saved.findIndex((todo) => todo.id === id);
    const todo = saved[index];
    if (todo) {
      saved[index] = { ...todo, done: !todo.done };
    }
    return saved[index];
  });
