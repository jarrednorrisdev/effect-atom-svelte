import { Deferred, Effect, Schema, Stream } from "effect";
import {
  AsyncResult,
  Atom,
  AtomRef,
  AtomRegistry,
  Hydration,
} from "effect/reactivity";
import { render } from "svelte/server";
import { afterEach, describe, expect, onTestFinished, test, vi } from "vitest";

import {
  useAtomInitialValues,
  useAtomRef,
  useAtomResult,
  useAtomSet,
  useAtomSuspense,
  useAtomValue,
} from "../src/index.ts";
import { makeClients } from "./clients.ts";
import BoundaryInitial from "./fixtures/boundary-initial.svelte";
import BoundaryLateInitial from "./fixtures/boundary-late-initial.svelte";
import BoundaryProvider from "./fixtures/boundary-provider.svelte";
import HydrateAbove from "./fixtures/hydrate-above.svelte";
import Hydrate from "./fixtures/hydrate.svelte";
import { pendingBoundaryComputed } from "./fixtures/pending-boundary.ts";
import Run from "./fixtures/run.svelte";
import ServerValueBoundary from "./fixtures/server-value-boundary.svelte";
import { serverValueComputed } from "./fixtures/server-value.ts";
import SsrChangingSeed from "./fixtures/ssr-changing-seed.svelte";
import SsrHarness from "./fixtures/ssr-harness.svelte";
import SsrHydrateAsync from "./fixtures/ssr-hydrate-async.svelte";
import SsrPendingBoundaryChild from "./fixtures/ssr-pending-boundary-child.svelte";
import SsrPendingBoundary from "./fixtures/ssr-pending-boundary.svelte";
import SsrSequential from "./fixtures/ssr-sequential.svelte";
import SsrTwoAsyncReaders from "./fixtures/ssr-two-async-readers.svelte";
import {
  defectAtom,
  serverSecret,
  streamAtom,
  unencodableAtom,
} from "./fixtures/unsent-seed.ts";
import { repeat, sleep } from "./helpers.ts";

let clients: ReturnType<typeof makeClients> | undefined;
afterEach(async () => {
  await clients?.dispose();
  clients = undefined;
});

const renderSetup = (
  setup: () => unknown,
  registry?: AtomRegistry.AtomRegistry
) => render(SsrHarness, { props: registry ? { registry, setup } : { setup } });

/**
 * Renders a RegistryProvider inside a boundary that fails when `fail` is set, and counts how often
 * a keepAlive atom read under the provider is finalized.
 */
const renderBoundaryProvider = async (fail: boolean) => {
  let finalized = 0;
  const atom = Atom.make((get) => {
    get.addFinalizer(() => {
      finalized += 1;
    });
    return "kept";
  }).pipe(Atom.keepAlive);
  const page = await render(BoundaryProvider, {
    props: {
      fail,
      setup: () => {
        const read = useAtomValue(atom);
        return () => read.current;
      },
    },
    transformError: (error: unknown) => ({ message: String(error) }),
  });
  expect(page.body).toContain(fail ? "failed" : "<output>kept</output>");
  await sleep(20);
  return { fail, finalized };
};

/** A serializable async atom that fails the test if anything computes it. */
const failsIfComputed = (key: string) =>
  Atom.make(
    Effect.sync((): string => {
      throw new Error("computed on the server");
    })
  ).pipe(
    Atom.serializable({
      key,
      schema: AsyncResult.Schema({ success: Schema.String }),
    })
  );

/** Collects Svelte's unresolved_hydratable warnings for the rest of the test, silencing them. */
const unresolvedWarnings = () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  onTestFinished(() => warn.mockRestore());
  return () =>
    warn.mock.calls.filter((call) =>
      String(call[0]).includes("unresolved_hydratable")
    );
};

/** Reads an async atom with useAtomResult, rendering its tag. */
const readTag =
  (atom: Atom.Atom<AsyncResult.AsyncResult<unknown, unknown>>) => () => {
    const result = useAtomResult(atom);
    return (async () => {
      const live = await result;
      return () => live.current._tag;
    })();
  };

/** Collects every warning for the rest of the test, silencing them. */
const allWarnings = () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  onTestFinished(() => warn.mockRestore());
  return () => warn.mock.calls.map((call) => String(call[0]));
};

/** A serializable stream atom that emits 1, 2 and 3, one every 5ms. */
const slowStreamAtom = (key: string) =>
  (
    Atom.make(
      Stream.make(1, 2, 3).pipe(Stream.tap(() => Effect.sleep("5 millis")))
    ) as Atom.Atom<AsyncResult.AsyncResult<number>>
  ).pipe(
    Atom.serializable({
      key,
      schema: AsyncResult.Schema({ success: Schema.Number }),
    })
  );

/** Reads a number atom with useAtomResult, rendering its value and whether it is waiting. */
const readValue =
  (
    atom: Atom.Atom<AsyncResult.AsyncResult<number>>,
    suspendOnWaiting: boolean
  ) =>
  () => {
    const result = useAtomResult(atom, { suspendOnWaiting });
    return (async () => {
      const live = await result;
      return () =>
        live.current._tag === "Success"
          ? `value ${live.current.value} waiting ${live.current.waiting}`
          : live.current._tag;
    })();
  };

/** A serializable number atom for HydrationBoundary to hydrate. */
const numberAtom = (key: string) =>
  Atom.make(0).pipe(
    Atom.keepAlive,
    Atom.serializable({ key, schema: Schema.Number })
  );

/** The state Hydration.dehydrate gives for a registry where the atom is `value`. */
const stateWith = (atom: Atom.Atom<number>, value: number) => {
  const registry = AtomRegistry.make();
  registry.set(atom as Atom.Writable<number>, value);
  const state = Hydration.dehydrate(registry);
  registry.dispose();
  return state;
};

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

  describe("what the server sends for hydration", () => {
    test("a defect isn't sent: its message and cause stay on the server", async () => {
      const output = await renderSetup(readTag(defectAtom));
      expect(output.body).toContain("Failure");
      const page = output.head + output.body;
      expect(page).not.toContain(serverSecret);
      expect(page).not.toContain("inner-secret-detail");
    });

    test("an interruption isn't sent", async () => {
      const atom = Atom.make(Effect.interrupt as Effect.Effect<string>).pipe(
        Atom.serializable({
          key: "unsent-interrupt",
          schema: AsyncResult.Schema({ success: Schema.String }),
        })
      );
      const output = await renderSetup(readTag(atom));
      expect(output.body).toContain("Failure");
      expect(output.head).not.toContain("Interrupt");
    });

    test("a typed error is sent, as part of the atom's schema", async () => {
      const atom = Atom.make(
        Effect.fail("todo 7 is missing") as Effect.Effect<string, string>
      ).pipe(
        Atom.serializable({
          key: "sent-typed-error",
          schema: AsyncResult.Schema({
            error: Schema.String,
            success: Schema.String,
          }),
        })
      );
      const output = await renderSetup(readTag(atom));
      expect(output.body).toContain("Failure");
      expect(output.head).toContain("todo 7 is missing");
    });

    test.each([
      ["a value that fails the schema's check", unencodableAtom],
      [
        "a typed error the schema doesn't cover",
        Atom.make(
          Effect.fail("not-in-schema") as unknown as Effect.Effect<string>
        ).pipe(
          Atom.serializable({
            key: "unsent-uncovered-error",
            schema: AsyncResult.Schema({ success: Schema.String }),
          })
        ),
      ],
    ])(
      "%s isn't sent, and the render goes on with a warning",
      async (_, atom) => {
        const warned = allWarnings();
        const output = await renderSetup(readTag(atom));
        expect(output.body).toMatch(/Success|Failure/u);
        expect(output.head).not.toContain("not-in-schema");
        expect(warned()).toEqual([
          expect.stringContaining(
            `"${atom[Atom.SerializableTypeId].key}" doesn't encode`
          ),
        ]);
      }
    );

    test("a stream still running when the render ends is sent as waiting", async () => {
      const output = await renderSetup(readTag(streamAtom));
      expect(output.body).toContain("Success");
      expect(output.head).toContain("waiting:true");
    });

    test("with suspendOnWaiting, the settled result the server rendered is sent", async () => {
      const output = await renderSetup(
        readValue(slowStreamAtom("waiting-seed"), true)
      );
      expect(output.body).toContain("value 3 waiting false");
      // A waiting seed would have the browser run the atom again for a value it already has.
      expect(output.head).not.toContain("waiting:true");
    });

    test("with suspendOnWaiting, the settled result is sent even when a reader without it came first", async () => {
      const atom = slowStreamAtom("shared-waiting-seed");
      const output = await render(SsrTwoAsyncReaders, {
        props: { first: readValue(atom, false), second: readValue(atom, true) },
      });
      expect(output.body).toContain("value 3 waiting false");
      // The first reader claims the key, but the seed must be what the second one rendered.
      expect(output.head).not.toContain("waiting:true");
    });
  });

  describe("HydrationBoundary", () => {
    test("updates an atom read above it before its children render", async () => {
      const atom = numberAtom("boundary-above");
      const output = await render(HydrateAbove, {
        props: {
          atom,
          readAbove: true,
          readInside: true,
          state: stateWith(atom, 5),
        },
      });
      // Above the boundary, the server had already rendered the atom's value before it.
      expect(output.body).toContain("<p>0</p>");
      expect(output.body).toContain("<output>5</output>");
    });

    test("drops the values nobody read when the render ends", async () => {
      const atom = numberAtom("boundary-unread");
      const registry = AtomRegistry.make();
      const props = { atom, readAbove: false, registry };
      const first = await render(HydrateAbove, {
        props: { ...props, readInside: false, state: stateWith(atom, 42) },
      });
      expect(first.body).toContain("<output>-</output>");
      // Kept, the first request's value would be the next request's.
      const second = await render(HydrateAbove, {
        props: { ...props, readInside: true, state: undefined },
      });
      expect(second.body).toContain("<output>0</output>");
      registry.dispose();
    });

    test("doesn't pass a value that lands after the render on to a later request", async () => {
      const atom = numberAtom("boundary-late");
      const registry = AtomRegistry.make();
      const late = Deferred.makeUnsafe<unknown>();
      // As Hydration.dehydrate(registry, { encodeInitialAs: "promise" }) gives for an Initial result.
      const state = [
        {
          dehydratedAt: Date.now(),
          key: "boundary-late",
          resultPromise: Effect.runPromise(Deferred.await(late)),
          value: 0,
          "~effect/reactivity/Hydration/DehydratedAtom": true,
        },
      ] as unknown as Hydration.DehydratedAtom[];
      const props = { atom, readAbove: false, registry };
      const first = await render(HydrateAbove, {
        props: { ...props, readInside: false, state },
      });
      expect(first.body).toContain("<output>-</output>");
      // The first request's value arrives after its render has ended.
      Deferred.doneUnsafe(late, Effect.succeed(42));
      await sleep("10 millis");
      const second = await render(HydrateAbove, {
        props: { ...props, readInside: true, state: undefined },
      });
      expect(second.body).toContain("<output>0</output>");
      registry.dispose();
    });

    test("renders a promise-encoded value that lands during the render", async () => {
      const atom = Atom.make(
        Effect.succeed("from load").pipe(Effect.delay("30 millis"))
      ).pipe(
        Atom.serializable({
          key: "boundary-promise",
          schema: AsyncResult.Schema({ success: Schema.String }),
        })
      );
      // As a load function would: dehydrated while the atom is still loading.
      const source = AtomRegistry.make();
      source.mount(atom);
      const state = Hydration.dehydrate(source, { encodeInitialAs: "promise" });
      const registry = AtomRegistry.make();
      const output = await render(SsrHydrateAsync, {
        props: {
          registry,
          setup: () => {
            const result = useAtomResult(atom);
            return (async () => {
              const live = await result;
              return () =>
                AsyncResult.isSuccess(live.current)
                  ? live.current.value
                  : live.current._tag;
            })();
          },
          state,
        },
      });
      expect(output.body).toContain("<output>from load</output>");
      source.dispose();
      registry.dispose();
    });
  });

  describe("the async hooks with a server value (JND-58)", () => {
    test("useAtomResult reads the server value without computing the atom", async () => {
      const atom = failsIfComputed("server-value-result").pipe(
        Atom.withServerValueInitial
      );
      const output = await renderSetup(() => {
        const result = useAtomResult(atom);
        return (async () => {
          const live = await result;
          return () => live.current._tag;
        })();
      });
      expect(output.body).toContain("Initial");
      // Nothing was computed, so there is nothing to hydrate from.
      expect(output.head).not.toContain("server-value-result");
    });

    test("useAtomSuspense resolves with the server value without computing the atom", async () => {
      const atom = failsIfComputed("server-value-suspense").pipe(
        Atom.withServerValue(() => AsyncResult.success("from the server value"))
      );
      const output = await renderSetup(() => {
        const value = useAtomSuspense(atom);
        return () => value.current;
      });
      expect(output.body).toContain("from the server value");
      expect(output.head).not.toContain("server-value-suspense");
    });

    test("useAtomSuspense rejects a pending server value instead of hanging", async () => {
      const atom = failsIfComputed("server-value-pending").pipe(
        Atom.withServerValueInitial
      );
      await expect(
        renderSetup(() => {
          const value = useAtomSuspense(atom);
          return () => value.current;
        })
      ).rejects.toThrow("pending snippet");
    });

    test("inside a boundary with a pending snippet, the server renders that instead", async () => {
      const output = await render(ServerValueBoundary);
      expect(output.body).toContain("loading");
      expect(serverValueComputed).toEqual([]);
    });
  });

  describe("the async hooks with an atom nothing has started", () => {
    const save = Atom.fn((value: string) => Effect.succeed(value));

    test("useAtomResult rejects instead of hanging", async () => {
      await expect(renderSetup(readTag(save))).rejects.toThrow(
        "has not started"
      );
    });

    test("useAtomSuspense rejects instead of hanging", async () => {
      await expect(
        renderSetup(() => {
          const value = useAtomSuspense(save);
          return () => value.current;
        })
      ).rejects.toThrow("has not started");
    });

    test("a serializable one rejects instead of hanging while it seeds", async () => {
      const idle = Atom.make<AsyncResult.AsyncResult<string>>(
        AsyncResult.initial()
      ).pipe(
        Atom.serializable({
          key: "idle-seed",
          schema: AsyncResult.Schema({ success: Schema.String }),
        })
      );
      await expect(renderSetup(readTag(idle))).rejects.toThrow(
        "has not started"
      );
    });
  });

  describe("a serializable atom read inside a boundary with a pending snippet (JND-86)", () => {
    // Pins today's behavior: the hook seeds at init, before Svelte knows the read is never rendered.
    test("with the hook outside the boundary, the server still computes, waits and embeds it", async () => {
      pendingBoundaryComputed.length = 0;
      const warnings = unresolvedWarnings();
      const output = await render(SsrPendingBoundary);
      expect(output.body).toContain("loading");
      expect(output.body).not.toContain("from the server");
      expect(pendingBoundaryComputed).toEqual(["server"]);
      // The response waited for the atom, and Svelte warns the wait was for nothing it rendered.
      expect(output.head).toContain("from the server");
      expect(warnings()).toHaveLength(1);
    });

    test("with the hook in a component inside the boundary, the server never calls it", async () => {
      pendingBoundaryComputed.length = 0;
      const warnings = unresolvedWarnings();
      const output = await render(SsrPendingBoundaryChild);
      expect(output.body).toContain("loading");
      expect(pendingBoundaryComputed).toEqual([]);
      expect(output.head).not.toContain("pending-boundary");
      expect(warnings()).toEqual([]);
    });
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

  test("each request applies its own initial values to a caller-owned registry", async () => {
    const registry = AtomRegistry.make();
    const count = Atom.make(0);
    const page = (start: number) => () => {
      useAtomInitialValues([[count, start]]);
      const value = useAtomValue(count);
      return () => value.current;
    };
    const first = await renderSetup(page(1), registry);
    expect(first.body).toContain("<output>1</output>");
    const second = await renderSetup(page(2), registry);
    expect(second.body).toContain("<output>2</output>");
    // Once the node is swept, the next request starts from a new one.
    await expect.poll(() => registry.getNodes().size).toBe(0);
    const third = await renderSetup(page(3), registry);
    expect(third.body).toContain("<output>3</output>");
    await expect.poll(() => registry.getNodes().size).toBe(0);
    registry.dispose();
  });

  test("a boundary that fails during setup still releases its atoms from a caller-owned registry", async () => {
    // Svelte's server renderer drops the content of a boundary whose children throw synchronously,
    // and with it their onDestroy callbacks, so releases also run when the render ends.
    const atom = Atom.make("default");
    const registry = AtomRegistry.make();
    const first = await render(BoundaryInitial, {
      props: { atom, fail: true, registry, value: "first visitor" },
      // As SvelteKit does with handleError: the boundary renders its failed snippet.
      transformError: (error: unknown) => ({ message: String(error) }),
    });
    expect(first.body).toContain("failed");
    await expect.poll(() => registry.getNodes().size).toBe(0);
    const second = await render(BoundaryInitial, {
      props: { atom, fail: false, registry, value: "second visitor" },
    });
    expect(second.body).toContain("<output>second visitor</output>");
    const third = await render(BoundaryInitial, {
      props: { atom, fail: false, registry, value: "third visitor" },
    });
    expect(third.body).toContain("<output>third visitor</output>");
    registry.dispose();
  });

  test("a failed boundary's component that awaits before its hooks still releases them", async () => {
    // The boundary drops the awaiting component, so the render ends before its script resumes and
    // registers its release on a signal that has already aborted.
    const atom = Atom.make("default");
    const registry = AtomRegistry.make();
    const first = await render(BoundaryLateInitial, {
      props: { atom, delay: 20, fail: true, registry, value: "first visitor" },
      transformError: (error: unknown) => ({ message: String(error) }),
    });
    expect(first.body).toContain("failed");
    await sleep(60);
    await expect.poll(() => registry.getNodes().size).toBe(0);
    const second = await render(BoundaryLateInitial, {
      props: { atom, delay: 0, fail: false, registry, value: "second visitor" },
    });
    expect(second.body).toContain("<output>second visitor</output>");
    registry.dispose();
  });

  test("a provider inside a boundary that fails during setup still disposes its registry", async () => {
    // The provider's registry is the request's own; dropped with the boundary, it would keep
    // its keepAlive atoms, and whatever they run, for good.
    expect(
      await Promise.all([
        renderBoundaryProvider(false),
        renderBoundaryProvider(true),
      ])
    ).toEqual([
      { fail: false, finalized: 1 },
      { fail: true, finalized: 1 },
    ]);
  });

  test("a reader kept past the render takes no mount on a caller-owned registry when its atom switches", async () => {
    const stopped: string[] = [];
    const tracked = (name: string) =>
      Atom.make((get) => {
        get.addFinalizer(() => stopped.push(name));
        return name;
      });
    const first = tracked("first");
    const next = tracked("next");
    let atom = first;
    let read: { readonly current: string } | undefined;
    const registry = AtomRegistry.make();
    const output = await renderSetup(() => {
      const value = useAtomValue(() => atom);
      read = value;
      return () => value.current;
    }, registry);
    expect(output.body).toContain("<output>first</output>");
    await expect.poll(() => registry.getNodes().size).toBe(0);
    atom = next;
    expect(read?.current).toBe("next");
    await expect.poll(() => registry.getNodes().size).toBe(0);
    expect(stopped).toEqual(["first", "next"]);
    registry.dispose();
  });

  test("an initial value starts a browser-only atom on the server without computing it", async () => {
    let computed = 0;
    const theme = Atom.make((): string => {
      computed += 1;
      throw new Error("localStorage is not defined");
    });
    const { body } = await renderSetup(() => {
      useAtomInitialValues([[theme, "dark"]]);
      const value = useAtomValue(theme);
      return () => value.current;
    });
    expect(body).toContain("<output>dark</output>");
    expect(computed).toBe(0);
  });

  test.each([
    ["useAtomResult", false],
    ["useAtomSuspense", false],
    ["useAtomResult", true],
    ["useAtomSuspense", true],
  ])(
    "%s (serializable: %s) renders an initial value without computing the atom on the server",
    async (hook, serializable) => {
      let fetched = 0;
      const plain = Atom.make(
        Effect.sync(() => {
          fetched += 1;
          return "fetched";
        })
      );
      const user = serializable
        ? plain.pipe(
            Atom.serializable({
              key: `initial-${hook}`,
              schema: AsyncResult.Schema({ success: Schema.String }),
            })
          )
        : plain;
      const { body } = await renderSetup(() => {
        useAtomInitialValues([[user, AsyncResult.success("initial")]]);
        if (hook === "useAtomResult") {
          const result = useAtomResult(user);
          return (async () => {
            const live = await result;
            return () =>
              live.current._tag === "Success" ? live.current.value : "";
          })();
        }
        const value = useAtomSuspense(user);
        return () => value.current;
      });
      expect(body).toContain("<output>initial</output>");
      expect(fetched).toBe(0);
    }
  );

  test("useAtomValue reading a serializable async atom warns once, in development, that its result isn't sent", async () => {
    const warned = allWarnings();
    const atom = Atom.make(Effect.succeed("todos")).pipe(
      Atom.serializable({
        key: "unsent-value-read",
        schema: AsyncResult.Schema({ success: Schema.String }),
      })
    );
    const read = () => {
      const value = useAtomValue(atom);
      return () => value.current._tag;
    };
    await renderSetup(read);
    await renderSetup(read);
    expect(
      warned().filter((message) => message.includes("unsent-value-read"))
    ).toEqual([
      expect.stringContaining(
        'useAtomValue read the serializable atom "unsent-value-read" on the server'
      ),
    ]);
  });

  test("the async hooks, and reads the browser repeats anyway, don't warn that a result isn't sent", async () => {
    const warned = allWarnings();
    const schema = AsyncResult.Schema({ success: Schema.String });
    const awaited = Atom.make(Effect.succeed("a")).pipe(
      Atom.serializable({ key: "sent-by-hook", schema })
    );
    const serverValue = Atom.make(Effect.succeed("b")).pipe(
      Atom.serializable({ key: "unsent-server-value", schema }),
      Atom.withServerValueInitial
    );
    const initial = Atom.make(Effect.succeed("c")).pipe(
      Atom.serializable({ key: "unsent-initial", schema })
    );
    const plain = Atom.make(Effect.succeed("d"));
    const mutation = Atom.fn((title: string) => Effect.succeed(title)).pipe(
      Atom.serializable({ key: "unsent-mutation", schema })
    );
    await renderSetup(() => {
      useAtomInitialValues([[initial, AsyncResult.success("c")]]);
      const values = [serverValue, initial, plain, mutation].map((atom) =>
        useAtomValue(atom)
      );
      const suspended = useAtomSuspense(awaited);
      const result = useAtomResult(awaited);
      return (async () => {
        await result;
        await suspended.current;
        return () => values.map((value) => value.current._tag).join(" ");
      })();
    });
    expect(
      warned().filter((message) => message.includes("on the server"))
    ).toEqual([]);
  });

  test("useAtomValue reading a value a HydrationBoundary brought doesn't warn: the boundary sends it", async () => {
    const warned = allWarnings();
    const atom = Atom.make(Effect.succeed("fetched")).pipe(
      Atom.serializable({
        key: "boundary-value-read",
        schema: AsyncResult.Schema({ success: Schema.String }),
      })
    );
    const registry = AtomRegistry.make();
    onTestFinished(() => registry.dispose());
    const state = [
      {
        dehydratedAt: 0,
        key: "boundary-value-read",
        value: atom[Atom.SerializableTypeId].encode(
          AsyncResult.success("from the load")
        ),
        "~effect/reactivity/Hydration/DehydratedAtom": true,
      },
    ] as unknown as readonly Hydration.DehydratedAtom[];
    const { body } = await render(Hydrate, {
      props: {
        registry,
        setup: () => {
          const value = useAtomValue(atom);
          return () =>
            value.current._tag === "Success" ? value.current.value : "";
        },
        state,
      },
    });
    expect(body).toContain("from the load");
    expect(
      warned().filter((message) => message.includes("boundary-value-read"))
    ).toEqual([]);
  });

  test("an initial value nothing reads leaves its async atom unstarted on the server", async () => {
    let fetched = 0;
    const user = Atom.make(Effect.sync(() => (fetched += 1)));
    const { body } = await renderSetup(() => {
      useAtomInitialValues([[user, AsyncResult.success(0)]]);
      return () => "layout";
    });
    expect(body).toContain("<output>layout</output>");
    expect(fetched).toBe(0);
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

  test("readers of one serialization key embed the first reader's seed, even if the atom changes between them", async () => {
    // Svelte's dev build runs every reader's hydratable callback and throws hydratable_clobbering if
    // what they encode differs.
    const atom = Atom.make<AsyncResult.AsyncResult<string>>(
      AsyncResult.success("seeded")
    ).pipe(
      Atom.serializable({
        key: "changing-seed",
        schema: AsyncResult.Schema({ success: Schema.String }),
      })
    );
    const output = await render(SsrChangingSeed, { props: { atom } });
    expect(output.head + output.body).toContain("seeded");
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
