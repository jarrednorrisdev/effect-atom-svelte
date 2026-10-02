import type { Todo } from "@demo/domain";
import { Effect } from "effect";
import type { Exit } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";
import { afterEach, describe, expect, test } from "vitest";
import { render } from "vitest-browser-svelte";

import { useAtomSet, useAtomSuspense, useAtomValue } from "../src/index.ts";
import { makeClients } from "./clients.ts";
import Harness from "./fixtures/harness.svelte";

const text = (screen: Awaited<ReturnType<typeof render>>) => () =>
  screen.container.textContent?.trim();

const titles = (todos: readonly Todo[]) =>
  todos.map((todo) => todo.title).join(", ");

let clients: ReturnType<typeof makeClients>;
afterEach(async () => {
  await clients.dispose();
});

describe("AtomRpc", () => {
  test("a query renders through useAtomSuspense", async () => {
    clients = makeClients();
    const { Rpc } = clients;
    const screen = await render(Harness, {
      async: true,
      setup: () => {
        const todos = useAtomSuspense(Rpc.query("listTodos"));
        return async () => titles(await todos.current);
      },
    });
    await expect
      .poll(text(screen))
      .toBe("Read the Effect Atom source, Write a Svelte adapter");
  });

  test("a mutation with reactivity keys refreshes the query", async () => {
    clients = makeClients();
    const { Rpc } = clients;
    const list = Rpc.query("listTodos", undefined, {
      reactivityKeys: ["todos"],
    });
    let create!: (input: {
      payload: { title: string };
      reactivityKeys: string[];
    }) => Promise<Todo>;
    const screen = await render(Harness, {
      async: true,
      setup: () => {
        const todos = useAtomSuspense(list);
        create = useAtomSet(Rpc.mutation("createTodo"), { mode: "promise" });
        return async () => (await todos.current).length;
      },
    });
    await expect.poll(text(screen)).toBe("2");
    const created = await create({
      payload: { title: "Ship it" },
      reactivityKeys: ["todos"],
    });
    expect(created.title).toBe("Ship it");
    await expect.poll(text(screen)).toBe("3");
  });

  test("a typed error comes back as a Failure with its tag", async () => {
    clients = makeClients();
    const { Rpc } = clients;
    const mutation = Rpc.mutation("createTodo");
    let create!: (input: {
      payload: { title: string };
    }) => Promise<Exit.Exit<Todo, unknown>>;
    const screen = await render(Harness, {
      setup: () => {
        const state = useAtomValue(mutation);
        create = useAtomSet(mutation, { mode: "promiseExit" });
        return () => state.current._tag;
      },
    });
    const exit = await create({ payload: { title: "x".repeat(61) } });
    expect(exit).toMatchObject({ _tag: "Failure" });
    await expect.poll(text(screen)).toBe("Failure");
  });

  test("a query family follows the selected id", async () => {
    clients = makeClients();
    const { Rpc } = clients;
    const registry = AtomRegistry.make();
    const selected = Atom.make(1);
    const screen = await render(Harness, {
      async: true,
      registry,
      setup: () => {
        const id = useAtomValue(selected);
        const todo = useAtomSuspense(() =>
          Rpc.query("getTodo", { id: id.current })
        );
        return async () => (await todo.current).title;
      },
    });
    await expect.poll(text(screen)).toBe("Read the Effect Atom source");
    registry.set(selected, 2);
    await expect.poll(text(screen)).toBe("Write a Svelte adapter");
    registry.set(selected, 99);
    await expect.poll(text(screen)).toBe("failed: TodoNotFound");
  });

  test("a streaming RPC is pulled chunk by chunk until done", async () => {
    clients = makeClients();
    const { Rpc } = clients;
    const ticks = Rpc.query("ticks", { count: 3 });
    let pull!: (value: undefined) => void;
    const screen = await render(Harness, {
      setup: () => {
        const result = useAtomValue(ticks);
        pull = useAtomSet(ticks);
        return () =>
          AsyncResult.match(result.current, {
            onFailure: () => "failed",
            onInitial: () => "initial",
            onSuccess: ({ value }) =>
              `${value.items.join(",")}${value.done ? " done" : ""}`,
          });
      },
    });
    await expect.poll(text(screen)).toBe("0");
    pull();
    await expect.poll(text(screen)).toBe("0,1");
    pull();
    await expect.poll(text(screen)).toBe("0,1,2");
    pull();
    await expect.poll(text(screen)).toBe("0,1,2 done");
  });

  test("runtime.fn composes RPC calls in an Effect", async () => {
    clients = makeClients();
    const { Rpc } = clients;
    const createTwo = Rpc.runtime.fn((prefix: string) =>
      Effect.gen(function* createTwoTodos() {
        const client = yield* Rpc;
        const first = yield* client("createTodo", { title: `${prefix} one` });
        const second = yield* client("createTodo", { title: `${prefix} two` });
        return [first.id, second.id];
      })
    );
    let run!: (prefix: string) => Promise<number[]>;
    await render(Harness, {
      setup: () => {
        run = useAtomSet(createTwo, { mode: "promise" });
        return () => "";
      },
    });
    await expect(run("batch")).resolves.toEqual([3, 4]);
  });

  test("optimisticFn shows the update before the server confirms it", async () => {
    clients = makeClients({ latency: "200 millis" });
    const { Rpc } = clients;
    const list = Atom.optimistic(
      Rpc.query("listTodos", undefined, { reactivityKeys: ["todos"] })
    );
    const addTodo = list.pipe(
      Atom.optimisticFn({
        fn: Rpc.runtime.fn((title: string) =>
          Effect.gen(function* createConfirmed() {
            const client = yield* Rpc;
            return yield* client("createTodo", { title });
          })
        ),
        reducer: (current, title: string) =>
          AsyncResult.map(current, (todos) => [
            ...todos,
            { done: false, id: -1, title } as Todo,
          ]),
      })
    );
    let add!: (title: string) => void;
    const screen = await render(Harness, {
      setup: () => {
        const todos = useAtomValue(list);
        add = useAtomSet(addTodo);
        return () =>
          AsyncResult.match(todos.current, {
            onFailure: () => "failed",
            onInitial: () => "initial",
            onSuccess: ({ value }) => String(value.length),
          });
      },
    });
    await expect.poll(text(screen)).toBe("2");
    add("Optimistic");
    await expect.poll(text(screen), { timeout: 150 }).toBe("3");
  });
});

describe("AtomHttpApi", () => {
  test("a query with query params", async () => {
    clients = makeClients();
    const { Http } = clients;
    const screen = await render(Harness, {
      async: true,
      setup: () => {
        const done = useAtomSuspense(
          Http.query("todos", "list", { query: { done: "true" } })
        );
        return async () => titles(await done.current);
      },
    });
    await expect.poll(text(screen)).toBe("Write a Svelte adapter");
  });

  test("a query with path params, and a typed 404", async () => {
    clients = makeClients();
    const { Http } = clients;
    const registry = AtomRegistry.make();
    const selected = Atom.make(1);
    const screen = await render(Harness, {
      async: true,
      registry,
      setup: () => {
        const id = useAtomValue(selected);
        const todo = useAtomSuspense(
          () => Http.query("todos", "get", { params: { id: id.current } }),
          {
            includeFailure: true,
          }
        );
        return async () => {
          const result = await todo.current;
          return result._tag === "Success"
            ? result.value.title
            : AsyncResult.match(result, {
                onFailure: ({ cause }) => String(cause),
                onInitial: () => "",
                onSuccess: () => "",
              });
        };
      },
    });
    await expect.poll(text(screen)).toBe("Read the Effect Atom source");
    registry.set(selected, 42);
    await expect.poll(text(screen)).toContain("TodoNotFound");
  });

  test("a mutation refreshes the list through reactivity keys, and 422 is typed", async () => {
    clients = makeClients();
    const { Http } = clients;
    const list = Http.query("todos", "list", {
      query: {},
      reactivityKeys: ["todos"],
    });
    let create!: (input: {
      payload: { title: string };
      reactivityKeys: string[];
    }) => Promise<Exit.Exit<Todo, unknown>>;
    const screen = await render(Harness, {
      async: true,
      setup: () => {
        const todos = useAtomSuspense(list);
        create = useAtomSet(Http.mutation("todos", "create"), {
          mode: "promiseExit",
        });
        return async () => (await todos.current).length;
      },
    });
    await expect.poll(text(screen)).toBe("2");
    await create({
      payload: { title: "Over HTTP" },
      reactivityKeys: ["todos"],
    });
    await expect.poll(text(screen)).toBe("3");
    const failed = await create({
      payload: { title: "x".repeat(61) },
      reactivityKeys: ["todos"],
    });
    expect(JSON.stringify(failed)).toContain("TitleTooLong");
  });
});
