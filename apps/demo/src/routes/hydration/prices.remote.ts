import { prerender } from "$app/server";
import { Effect } from "effect";
import { AtomRegistry, Hydration } from "effect/reactivity";

import { pricesAtom, pricesWithKeysAtom } from "./prices.ts";

// A remote function runs on the server. As a prerender function on a prerendered page,
// it runs once, when the site is built.
export const pricesState = prerender(async () => {
  const registry = AtomRegistry.make();
  const atoms = [pricesAtom, pricesWithKeysAtom];
  const releases = atoms.map((atom) => registry.mount(atom));
  await Effect.runPromise(
    Effect.all(atoms.map((atom) => AtomRegistry.getResult(registry, atom)))
  );
  const state = Hydration.dehydrate(registry);
  for (const release of releases) {
    release();
  }
  registry.dispose();
  return state;
});
