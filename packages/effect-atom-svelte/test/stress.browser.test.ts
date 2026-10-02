import { AtomRegistry } from "effect/reactivity";
import { flushSync } from "svelte";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { render } from "vitest-browser-svelte";

import Stress from "./fixtures/stress.svelte";
import { makeStressAtoms } from "./fixtures/stress.ts";
import { sleep } from "./helpers.ts";

// The registry notifies subscribers while it computes an atom, which would be a state change during a
// template or $derived read (state_unsafe_mutation). Hooks defer notifications raised during a read
// to a microtask and deliver the rest synchronously (`activeReads` in Hooks.svelte.ts). These tests
// put many readers of shared chains under bursts of writes to check both halves hold (JND-22).
//
// The registry rebuilds an observed atom as soon as a write makes it stale, so a reader of a fixed
// atom never builds it and nothing is deferred. A read only notifies when it builds an atom that is
// already subscribed: the first render, or a getter switching to a new atom. The readers follow a
// getter to a new atom per count, so every write in the burst takes the deferred path.

const readers = 12;
const writes = 60;

/** Errors the page reports outside the boundary, such as a throw from a microtask. */
let pageErrors: unknown[] = [];
const onError = (event: ErrorEvent) => pageErrors.push(event.error);
const onRejection = (event: PromiseRejectionEvent) =>
  pageErrors.push(event.reason);

beforeEach(() => {
  pageErrors = [];
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
});

afterEach(() => {
  window.removeEventListener("error", onError);
  window.removeEventListener("unhandledrejection", onRejection);
});

const setup = async () => {
  const registry = AtomRegistry.make();
  const atoms = makeStressAtoms();
  const errors: unknown[] = [];
  const screen = await render(Stress, { atoms, errors, readers, registry });
  const byPrefix = (prefix: string) =>
    Array.from(
      screen.container.querySelectorAll(`[data-testid^="${prefix}-"]`),
      (element) => element.textContent?.trim()
    );
  const button = screen.container.querySelector("button");
  if (!button) {
    throw new Error("The stress fixture has no button");
  }
  return { atoms, button, byPrefix, errors, registry, screen };
};

/** What every reader shows once `count` has settled on `count`. */
const expected = (count: number) => {
  const plusOne = count + 1;
  const doubled = plusOne * 2;
  const label = `${plusOne}/${doubled}`;
  return {
    async: `${doubled} d${doubled} df${count} ${label}`,
    sync: `${label} ${doubled} ${plusOne} f${count}/${plusOne}`,
  };
};

const everyReader = (text: string) =>
  Array.from({ length: readers }, () => text);

/** Waits for every reader to show `count`'s values, reporting any error caught on the way. */
const settledOn = async (
  { byPrefix, errors }: Awaited<ReturnType<typeof setup>>,
  count: number
) => {
  const { async, sync } = expected(count);
  await expect
    .poll(() => ({
      async: byPrefix("async"),
      errors: [...errors, ...pageErrors].map(String),
      sync: byPrefix("sync"),
    }))
    .toEqual({
      async: everyReader(async),
      errors: [],
      sync: everyReader(sync),
    });
};

describe("notification deferral under load", () => {
  test("bursts of timer and click writes leave every reader consistent, with no errors", async () => {
    const stress = await setup();
    const { atoms, button, byPrefix, errors, registry } = stress;
    await settledOn(stress, 0);

    // Timers write the count at staggered times, some in the same macrotask, while clicks write
    // another atom the same readers show.
    for (let index = 0; index < writes; index += 1) {
      setTimeout(() => registry.update(atoms.count, (n) => n + 1), index % 20);
      setTimeout(() => button.click(), (index * 7) % 20);
    }
    await sleep("40 millis");

    await settledOn(stress, writes);
    await expect
      .poll(() => byPrefix("clicks"))
      .toEqual(everyReader(`c${writes}`));
    expect(errors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("a click shows its write in the DOM as soon as Svelte flushes, in the same tick", async () => {
    const stress = await setup();
    const { button, byPrefix, errors } = stress;
    await settledOn(stress, 0);

    // A notification deferred to a microtask would arrive after flushSync and leave the old text.
    for (let index = 1; index <= 5; index += 1) {
      button.click();
      flushSync();
      expect(byPrefix("clicks")).toEqual(everyReader(`c${index}`));
    }
    expect(errors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
