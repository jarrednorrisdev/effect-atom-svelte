import { Effect, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry, Hydration } from "effect/reactivity";
import { describe, expect, test } from "vitest";
import { render } from "vitest-browser-svelte";

import { useAtomValue } from "../src/index.ts";
import Hydrate from "./fixtures/hydrate.svelte";
import { text } from "./helpers.ts";

const countAtom = Atom.make(0).pipe(
  Atom.serializable({ key: "count", schema: Schema.Number })
);

/** Simulates the server: computes atoms in a registry and dehydrates it through JSON. */
const serverState = (
  atoms: readonly Atom.Atom<unknown>[],
  setup: (registry: AtomRegistry.AtomRegistry) => void,
  options?: Parameters<typeof Hydration.dehydrate>[1]
) => {
  const registry = AtomRegistry.make();
  for (const atom of atoms) {
    registry.mount(atom);
  }
  setup(registry);
  return Hydration.dehydrate(registry, options);
};

const readCount = () => {
  const count = useAtomValue(countAtom);
  return () => count.current;
};

describe("HydrationBoundary", () => {
  test("hydrates atoms that survive a JSON round trip", async () => {
    // oxlint-disable-next-line unicorn/prefer-structured-clone -- the JSON round trip simulates the wire, which structuredClone would not
    const state = JSON.parse(
      JSON.stringify(
        serverState([countAtom], (registry) => registry.set(countAtom, 42))
      )
    );
    const screen = await render(Hydrate, {
      registry: AtomRegistry.make(),
      setup: readCount,
      state,
    });
    await expect.poll(text(screen)).toBe("42");
  });

  test("an empty or missing state is a no-op", async () => {
    const empty = await render(Hydrate, {
      registry: AtomRegistry.make(),
      setup: readCount,
      state: [],
    });
    await expect.poll(text(empty)).toBe("0");
    const missing = await render(Hydrate, {
      registry: AtomRegistry.make(),
      setup: readCount,
      state: undefined,
    });
    await expect.poll(text(missing)).toBe("0");
  });

  test("new atoms hydrate before children render; existing ones update after", async () => {
    const registry = AtomRegistry.make();
    registry.mount(countAtom);
    registry.set(countAtom, 1);
    const seen: number[] = [];
    const state = serverState([countAtom], (server) =>
      server.set(countAtom, 2)
    );
    const screen = await render(Hydrate, {
      registry,
      setup: () => {
        const count = useAtomValue(countAtom);
        return () => {
          seen.push(count.current);
          return count.current;
        };
      },
      state,
    });
    await expect.poll(text(screen)).toBe("2");
    // The existing atom rendered its current value first, then took the hydrated one.
    expect(seen[0]).toBe(1);
  });

  test("an Initial result dehydrated as a promise finishes on the client", async () => {
    const slowAtom = Atom.make(
      Effect.succeed("from server").pipe(Effect.delay("100 millis"))
    ).pipe(
      Atom.serializable({
        key: "slow",
        schema: AsyncResult.Schema({ success: Schema.String }),
      })
    );
    const state = serverState([slowAtom], () => undefined, {
      encodeInitialAs: "promise",
    });
    const screen = await render(Hydrate, {
      registry: AtomRegistry.make(),
      setup: () => {
        const result = useAtomValue(slowAtom);
        return () => result.current._tag;
      },
      state,
    });
    await expect.poll(text(screen)).toBe("Success");
  });
});
