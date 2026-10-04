import { TodosRpc } from "#lib/clients.ts";

// The demo server's todo list, over RPC. A mutation that invalidates "todos" fetches it
// again.
export const todosAtom = TodosRpc.query("listTodos", undefined, {
  reactivityKeys: ["todos"],
});
