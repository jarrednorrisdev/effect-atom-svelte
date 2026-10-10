import { Effect } from "effect";
import { AtomRegistry } from "effect/reactivity";
import { expect, test } from "vitest";

import { countAtom, doubledAtom, savedAtom, submitAtom } from "./counter.ts";

// Gives the registry a moment to run what it scheduled.
const nextTask = () => Effect.runPromise(Effect.sleep("1 millis"));

// Each test makes its own registry, so no state carries over between tests.
test("a derived atom follows its source", () => {
  const registry = AtomRegistry.make();
  expect(registry.get(doubledAtom)).toBe(0);

  registry.set(countAtom, 2);
  expect(registry.get(doubledAtom)).toBe(4);
});

test("an atom nothing holds goes back to its initial value", async () => {
  const registry = AtomRegistry.make();
  registry.set(countAtom, 2);

  // The registry drops atoms without readers once the current task ends.
  await nextTask();
  expect(registry.get(countAtom)).toBe(0);
});

test("mount holds an atom, as a reading component would", async () => {
  const registry = AtomRegistry.make();
  const release = registry.mount(countAtom);
  registry.set(countAtom, 2);

  await nextTask();
  expect(registry.get(countAtom)).toBe(2);
  release();
});

test("getResult waits for an async atom's value", async () => {
  const registry = AtomRegistry.make();
  registry.set(countAtom, 3);

  const saved = await Effect.runPromise(
    AtomRegistry.getResult(registry, savedAtom)
  );
  expect(saved).toBe("Saved 3");
});

test("a mutation's result, with set and getResult", async () => {
  const registry = AtomRegistry.make();
  // Held, as a component's useAtomSet would hold it, so results carry over.
  const release = registry.mount(submitAtom);

  registry.set(submitAtom, 3);
  const first = await Effect.runPromise(
    AtomRegistry.getResult(registry, submitAtom)
  );
  expect(first).toBe("Submitted 3");

  // While the second call runs, the atom still holds the first result.
  // suspendOnWaiting waits for this call's result instead.
  registry.set(submitAtom, 4);
  const second = await Effect.runPromise(
    AtomRegistry.getResult(registry, submitAtom, { suspendOnWaiting: true })
  );
  expect(second).toBe("Submitted 4");
  release();
});
