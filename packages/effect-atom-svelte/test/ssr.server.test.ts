import { Effect, Schema } from "effect";
import { AsyncResult, Atom, AtomRef, AtomRegistry } from "effect/reactivity";
import { render } from "svelte/server";
import { afterEach, describe, expect, test } from "vitest";

import {
  useAtomRef,
  useAtomResult,
  useAtomSet,
  useAtomSuspense,
  useAtomValue,
} from "../src/index.ts";
import { makeClients } from "./clients.ts";
import Run from "./fixtures/run.svelte";
import SsrHarness from "./fixtures/ssr-harness.svelte";
import SsrSequential from "./fixtures/ssr-sequential.svelte";
import { repeat } from "./helpers.ts";

let clients: ReturnType<typeof makeClients> | undefined;
afterEach(async () => {
  await clients?.dispose();
  clients = undefined;
});

const renderSetup = (
  setup: () => unknown,
  registry?: AtomRegistry.AtomRegistry
) => render(SsrHarness, { props: registry ? { registry, setup } : { setup } });

describe("server rendering", () => {
  test("awaits an RPC query and embeds its encoded result for hydration", async () => {
    clients = makeClients();
    const { Rpc } = clients;
    const todos = Rpc.query("listTodos", undefined, {
      serializationKey: "all",
    });
    const output = await renderSetup(() => {
      const result = useAtomResult(todos);
      return (async () => {
        const live = await result;
        return () =>
          live.current._tag === "Success"
            ? live.current.value.map((todo) => todo.title).join(", ")
            : "";
      })();
    });
    expect(output.body).toContain(
      "Read the Effect Atom source, Write a Svelte adapter"
    );
    expect(output.head + output.body).toContain("AtomRpc:listTodos:all");
  });

  test("awaits useAtomSuspense in markup over HTTP", async () => {
    clients = makeClients();
    const { Http } = clients;
    const done = Http.query("todos", "list", { query: { done: "true" } });
    const output = await renderSetup(() => {
      const todos = useAtomSuspense(done);
      return async () => {
        const list = await todos.current;
        return list.map((todo) => todo.title).join(", ");
      };
    });
    expect(output.body).toContain("Write a Svelte adapter");
  });

  test("hooks between top-level awaits work on the server too", async () => {
    const output = await render(SsrSequential, {
      props: {
        first: Atom.make(Effect.succeed("one").pipe(Effect.delay("20 millis"))),
        plain: Atom.make(2),
        second: Atom.make(
          Effect.succeed("three").pipe(Effect.delay("20 millis"))
        ),
      },
    });
    expect(output.body).toContain("one 2 three");
  });

  test("concurrent requests get isolated registries", async () => {
    const shared = Atom.make("default");
    const slow = Atom.make(Effect.sleep("30 millis").pipe(Effect.as("done")));
    const withValue = (value: string) =>
      AtomRegistry.make({ initialValues: [[shared, value]] });
    const setup = () => {
      const value = useAtomValue(shared);
      const wait = useAtomSuspense(slow);
      return async () => `${await wait.current}:${value.current}`;
    };
    const [a, b, c] = await Promise.all([
      renderSetup(setup, withValue("a")),
      renderSetup(setup, withValue("b")),
      renderSetup(setup),
    ]);
    expect(a.body).toContain("done:a");
    expect(b.body).toContain("done:b");
    expect(c.body).toContain("done:default");
  });

  test("withServerValue overrides what the server renders", async () => {
    const clientOnly = Atom.make("client").pipe(
      Atom.withServerValue(() => "server")
    );
    const output = await renderSetup(() => {
      const value = useAtomValue(clientOnly);
      return () => value.current;
    });
    expect(output.body).toContain("server");
    expect(output.body).not.toContain("client");
  });

  test("an atom with a server value is not computed on the server", async () => {
    const browserOnly = Atom.make((): string => {
      throw new Error("computed on the server");
    }).pipe(Atom.withServerValue(() => "server value"));
    const output = await renderSetup(() => {
      const value = useAtomValue(browserOnly);
      return () => value.current;
    });
    expect(output.body).toContain("server value");
  });

  test("refuses to share a registry between requests when none is provided", async () => {
    const atom = Atom.make(1);
    await expect(async () => {
      const output = await render(Run, {
        props: {
          setup: () => {
            const value = useAtomValue(atom);
            return () => value.current;
          },
        },
      });
      return output;
    }).rejects.toThrow("No AtomRegistry in context");
  });

  test("disposes the request's registry after rendering", async () => {
    const log: string[] = [];
    const atom = Atom.make((get) => {
      log.push("start");
      get.addFinalizer(() => log.push("stop"));
      return Effect.succeed("value");
    });
    const output = await renderSetup(() => {
      const value = useAtomSuspense(atom);
      return () => value.current;
    });
    expect(output.body).toContain("value");
    await expect.poll(() => log).toEqual(["start", "stop"]);
  });

  test("releases each request's atoms from a caller-owned registry", async () => {
    const log: string[] = [];
    const track = (
      name: string,
      get: { readonly addFinalizer: (f: () => void) => void }
    ) => {
      log.push(`start ${name}`);
      get.addFinalizer(() => log.push(`stop ${name}`));
    };
    const plain = Atom.make((get) => {
      track("plain", get);
      return "plain";
    });
    const suspended = Atom.make((get) => {
      track("suspended", get);
      return Effect.succeed("suspended");
    });
    const seeded = Atom.make((get) => {
      track("seeded", get);
      return Effect.succeed("seeded");
    }).pipe(
      Atom.serializable({
        key: "seeded",
        schema: AsyncResult.Schema({ success: Schema.String }),
      })
    );
    const registry = AtomRegistry.make();
    const setup = () => {
      const value = useAtomValue(plain);
      const wait = useAtomSuspense(suspended);
      const result = useAtomResult(seeded);
      return async () => {
        const live = await result;
        const seededValue =
          live.current._tag === "Success" ? live.current.value : "";
        return `${value.current} ${await wait.current} ${seededValue}`;
      };
    };
    const request = async () => {
      log.length = 0;
      const output = await renderSetup(setup, registry);
      expect(output.body).toContain("plain suspended seeded");
      // Every request embeds its own seed, not only the first one on this registry.
      expect(output.head + output.body).toContain('"seeded"');
      await expect.poll(() => registry.getNodes().size).toBe(0);
      // Finalizers run in no particular order across atoms.
      expect(log).toHaveLength(6);
      expect(new Set(log)).toEqual(
        new Set([
          "start plain",
          "start seeded",
          "start suspended",
          "stop plain",
          "stop seeded",
          "stop suspended",
        ])
      );
    };

    await request();
    await request();
    registry.dispose();
  });

  test("repeated renders leave nothing behind (JND-21)", async () => {
    const cycles = 10;
    const log: string[] = [];
    const track = (
      name: string,
      get: { readonly addFinalizer: (f: () => void) => void }
    ) => {
      log.push(`start ${name}`);
      get.addFinalizer(() => log.push(`stop ${name}`));
    };
    const plain = Atom.make((get) => {
      track("plain", get);
      return 1;
    });
    const written = Atom.writable(
      (get) => {
        track("written", get);
        return 1;
      },
      (ctx, value: number) => ctx.setSelf(value)
    );
    const suspended = Atom.make((get) => {
      track("suspended", get);
      return Effect.succeed("suspended");
    });
    const seeded = Atom.make((get) => {
      track("seeded", get);
      return Effect.succeed("seeded");
    }).pipe(
      Atom.serializable({
        key: "leak-seeded",
        schema: AsyncResult.Schema({ success: Schema.String }),
      })
    );
    const ref = AtomRef.make("ref");
    const setup = () => {
      const value = useAtomValue(plain);
      const set = useAtomSet(written);
      set((n) => n + 1);
      const wait = useAtomSuspense(suspended);
      const result = useAtomResult(seeded);
      const refValue = useAtomRef(ref);
      return async () => {
        const live = await result;
        const seededValue =
          live.current._tag === "Success" ? live.current.value : "";
        return `${value.current} ${await wait.current} ${seededValue} ${refValue.current}`;
      };
    };
    const expected = "1 suspended seeded ref";
    // Finalizers run in no particular order across atoms, so compare each render's log as a set.
    const names = ["plain", "written", "suspended", "seeded"];
    const startsAndStops = new Set(
      names.flatMap((name) => [`start ${name}`, `stop ${name}`])
    );
    const expectBalanced = async () => {
      await expect.poll(() => log.length).toBe(startsAndStops.size);
      expect(new Set(log)).toEqual(startsAndStops);
      log.length = 0;
    };

    // A registry the caller owns: every request's atoms are released from it.
    const registry = AtomRegistry.make();
    await repeat(cycles, async () => {
      const output = await renderSetup(setup, registry);
      expect(output.body).toContain(expected);
      await expect.poll(() => registry.getNodes().size).toBe(0);
      await expectBalanced();
    });
    registry.dispose();

    // The provider's own registry: disposing it at the end of the request runs every finalizer.
    await repeat(cycles, async () => {
      const output = await renderSetup(setup);
      expect(output.body).toContain(expected);
      await expectBalanced();
    });
  });

  test("two different atoms with the same serialization key are rejected", async () => {
    clients = makeClients();
    const { Rpc } = clients;
    const first = Rpc.query("listTodos", undefined, {
      serializationKey: "dup",
    });
    const second = Rpc.query("listTodos", undefined, {
      reactivityKeys: ["x"],
      serializationKey: "dup",
    });
    await expect(async () => {
      const output = await renderSetup(() => {
        const a = useAtomSuspense(first);
        const b = useAtomSuspense(second);
        return async () => {
          const [left, right] = await Promise.all([a.current, b.current]);
          return `${left.length}${right.length}`;
        };
      });
      return output;
    }).rejects.toThrow('share the serialization key "AtomRpc:listTodos:dup"');
  });
});
