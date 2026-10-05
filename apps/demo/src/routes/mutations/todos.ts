import { TodosRpc } from "#lib/clients.ts";

// The demo server's todos. Tagged "todos": it runs again when a mutation
// invalidates that key.
export const todosAtom = TodosRpc.query("listTodos", undefined, {
  reactivityKeys: ["todos"],
});

// Each write sends one createTodo request.
export const createAtom = TodosRpc.mutation("createTodo");

// Removes a todo you added. The two the server starts with stay.
export const removeAtom = TodosRpc.mutation("removeTodo");
