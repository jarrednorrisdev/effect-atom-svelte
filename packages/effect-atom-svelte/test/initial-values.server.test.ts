// Initial values on a registry the caller shares between server requests.
import { Deferred, Effect } from "effect";
import { Atom, AtomRegistry } from "effect/reactivity";
import { render } from "svelte/server";
import { describe, expect, test } from "vitest";

import { useAtomInitialValues, useAtomValue } from "../src/index.ts";
import SsrHarness from "./fixtures/ssr-harness.svelte";
import { sleep } from "./helpers.ts";

const renderSetup = (
  setup: () => unknown,
  registry?: AtomRegistry.AtomRegistry
) => render(SsrHarness, { props: registry ? { registry, setup } : { setup } });

/** A promise the test resolves when it chooses. */
const gate = () => {
  const deferred = Deferred.makeUnsafe<undefined>();
  return {
    open: () => Deferred.doneUnsafe(deferred, Effect.undefined),
    promise: Effect.runPromise(Deferred.await(deferred)),
  };
};

describe("concurrent requests on a caller-owned registry", () => {
  test("a request ending does not take the initial value from one still rendering", async () => {
    const registry = AtomRegistry.make();
    let computed = 0;
    const theme = Atom.make((): string => {
      computed += 1;
      throw new Error("localStorage is not defined");
    });
    const page = (wait: Promise<void>) => () => {
      useAtomInitialValues([[theme, "dark"]]);
      const value = useAtomValue(theme);
      return (async () => {
        await wait;
        return () => value.current;
      })();
    };
    const a = gate();
    const b = gate();
    // Svelte's render is lazy: Promise.resolve starts each one now, so they overlap.
    const first = Promise.resolve(renderSetup(page(a.promise), registry));
    // Its failure is shown as text, so the assertion says what went wrong.
    const second = (async () => {
      try {
        const { body } = await renderSetup(page(b.promise), registry);
        return body;
      } catch (error) {
        return `threw: ${String(error)}`;
      }
    })();
    await sleep("10 millis");
    a.open();
    const { body: firstBody } = await first;
    expect(firstBody).toContain("<output>dark</output>");
    // Give the registry time to sweep anything the first request let go of.
    await sleep("50 millis");
    b.open();
    const secondBody = await second;
    expect(secondBody).toContain("<output>dark</output>");
    expect(computed).toBe(0);
    registry.dispose();
  });

  test("a request starting while another renders does not overwrite the value it renders", async () => {
    const registry = AtomRegistry.make();
    const count = Atom.make(0);
    const page = (start: number, wait: Promise<void>) => () => {
      useAtomInitialValues([[count, start]]);
      const value = useAtomValue(count);
      return (async () => {
        await wait;
        return () => value.current;
      })();
    };
    const a = gate();
    const b = gate();
    const c = gate();
    const first = Promise.resolve(renderSetup(page(1, a.promise), registry));
    const second = Promise.resolve(renderSetup(page(2, b.promise), registry));
    await sleep("10 millis");
    a.open();
    const { body: firstBody } = await first;
    expect(firstBody).toContain("<output>1</output>");
    // The second request is still rendering when a third one starts.
    const third = Promise.resolve(renderSetup(page(3, c.promise), registry));
    await sleep("10 millis");
    b.open();
    // It shares the value the first request applied, as documented.
    const { body: secondBody } = await second;
    expect(secondBody).toContain("<output>1</output>");
    c.open();
    await third;
    registry.dispose();
  });
});

// On a registry shared between requests, an entry still held would be the next request's value.
const nextRequestRendersItsOwnValue = async (
  initialValues: Iterable<readonly [Atom.Atom<unknown>, unknown]>,
  count: Atom.Writable<number>
) => {
  const registry = AtomRegistry.make();
  await expect(
    Promise.resolve(
      renderSetup(() => {
        useAtomInitialValues(initialValues);
        return () => "unreachable";
      }, registry)
    )
  ).rejects.toThrow();
  const { body } = await renderSetup(() => {
    useAtomInitialValues([[count, 2]]);
    const value = useAtomValue(count);
    return () => value.current;
  }, registry);
  expect(body).toContain("<output>2</output>");
  registry.dispose();
};

describe("initial values that throw midway", () => {
  test("a list with a missing atom lets go of the entries before it", async () => {
    const count = Atom.make(0);
    await nextRequestRendersItsOwnValue(
      [
        [count, 1],
        [undefined as never, 2],
      ],
      count
    );
  });

  test("a generator that throws lets go of the entries before it", async () => {
    const count = Atom.make(0);
    const other = Atom.make(0);
    const broken = function* broken(): Generator<
      readonly [Atom.Atom<unknown>, unknown]
    > {
      yield [count, 1];
      yield [other, JSON.parse("{not json")];
    };
    await nextRequestRendersItsOwnValue(broken(), count);
  });
});
