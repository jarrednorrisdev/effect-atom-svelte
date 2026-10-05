import { Layer } from "effect";
import { Atom } from "effect/reactivity";

import { createTodo, listTodos } from "./api.ts";

// Tagged "todos": it runs again when a mutation invalidates that key.
export const todosAtom = Atom.make(listTodos).pipe(
  Atom.withReactivity(["todos"])
);

// reactivityKeys need a runtime, even one with no services.
export const runtime = Atom.runtime(Layer.empty);

// When a call succeeds, every atom tagged "todos" runs again.
export const createAtom = runtime.fn(createTodo, {
  reactivityKeys: ["todos"],
});
