import { RegistryProvider } from "effect-atom-svelte";
import { AtomRegistry } from "effect/reactivity";
import { expect, test } from "vitest";
import { render } from "vitest-browser-svelte";

import Counter from "./counter.svelte";
import { countAtom } from "./counter.ts";

test("a click writes to the registry", async () => {
  const registry = AtomRegistry.make();
  const screen = await render(
    Counter,
    {},
    { wrapper: RegistryProvider, wrapperProps: { registry } }
  );

  await screen.getByRole("button").click();
  expect(registry.get(countAtom)).toBe(1);

  // Writes from the test reach the component too.
  registry.set(countAtom, 5);
  await expect.element(screen.getByText("Doubled: 10")).toBeVisible();
  registry.dispose();
});

test("initialValues start the component in a given state", async () => {
  const screen = await render(
    Counter,
    {},
    {
      wrapper: RegistryProvider,
      wrapperProps: { initialValues: [[countAtom, 20]] },
    }
  );

  await expect.element(screen.getByText("Doubled: 40")).toBeVisible();
});
