import { Effect } from "effect";
import { AtomRegistry, Hydration } from "effect/reactivity";

import { reactiveQuery } from "./reactive-query.ts";

/**
 * The dehydrated query, as a SvelteKit remote function would return it: computed on the server,
 * then sent with the page and awaited again during hydration (JND-95).
 */
export const dehydratedQuery = async (): Promise<
  readonly Hydration.DehydratedAtom[]
> => {
  const registry = AtomRegistry.make();
  const release = registry.mount(reactiveQuery);
  await Effect.runPromise(AtomRegistry.getResult(registry, reactiveQuery));
  const state = Hydration.dehydrate(registry);
  release();
  registry.dispose();
  return state;
};
