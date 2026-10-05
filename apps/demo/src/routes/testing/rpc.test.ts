import { TitleTooLong, Todo, TodoNotFound, TodosRpcs } from "@demo/domain";
import { Effect, Layer, Stream } from "effect";
import { RegistryProvider } from "effect-atom-svelte";
import { Reactivity } from "effect/reactivity";
import { RpcTest } from "effect/rpc";
import { expect, test } from "vitest";
import { render } from "vitest-browser-svelte";

import { TodosRpc } from "#lib/clients.ts";

import Todos from "../rpc/todos.svelte";

// Handlers for every procedure in the group, keeping todos in an array.
const makeHandlers = (todos: Todo[]) =>
  TodosRpcs.toLayer({
    createTodo: ({ title }) => {
      if (title.length > 20) {
        return Effect.fail(new TitleTooLong({ maxLength: 20 }));
      }
      const todo = new Todo({ done: false, id: todos.length + 1, title });
      todos.push(todo);
      return Effect.succeed(todo);
    },
    getTodo: ({ id }) => Effect.fail(new TodoNotFound({ id })),
    listTodos: () => Effect.sync(() => [...todos]),
    removeTodo: ({ id }) => Effect.fail(new TodoNotFound({ id })),
    ticks: () => Stream.empty,
    toggleTodo: ({ id }) => Effect.fail(new TodoNotFound({ id })),
  });

// The app's own client class, answered in memory by the handlers above.
const TodosRpcTest = (todos: Todo[]) =>
  Layer.effect(TodosRpc)(RpcTest.makeClient(TodosRpcs, { flatten: true })).pipe(
    Layer.provide(makeHandlers(todos)),
    // Replacing the runtime's layer replaces its Reactivity too, which
    // reactivityKeys need.
    Layer.provideMerge(Reactivity.layer)
  );

const renderTodos = (todos: Todo[]) =>
  render(
    Todos,
    {},
    {
      wrapper: RegistryProvider,
      wrapperProps: {
        initialValues: [[TodosRpc.runtime.layer, TodosRpcTest(todos)]],
      },
    }
  );

test("adding a todo refreshes the list", async () => {
  const screen = await renderTodos([
    new Todo({ done: false, id: 1, title: "Write tests" }),
  ]);
  await expect.element(screen.getByText("Write tests")).toBeVisible();

  await screen.getByPlaceholder("New todo").fill("Ship it");
  await screen.getByRole("button", { name: "Add" }).click();
  await expect.element(screen.getByText("Ship it")).toBeVisible();
});

test("a typed error reaches the component", async () => {
  const screen = await renderTodos([]);

  await screen.getByPlaceholder("New todo").fill("A title far too long to fit");
  await screen.getByRole("button", { name: "Add" }).click();
  await expect.element(screen.getByText(/TitleTooLong/u)).toBeVisible();
});
