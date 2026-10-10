import { Schema } from "effect";
import { Atom } from "effect/reactivity";
import type { Hydration } from "effect/reactivity";

/** An atom a RegistryProvider gives an initial value and a HydrationBoundary hydrates. */
export const providerSeedAtom = Atom.make(0).pipe(
  Atom.serializable({ key: "provider-seed", schema: Schema.Number })
);

/** What a load function would dehydrate: the atom's fresh value, 2. */
export const providerSeedState = [
  {
    dehydratedAt: 0,
    key: "provider-seed",
    value: 2,
    "~effect/reactivity/Hydration/DehydratedAtom": true,
  },
] as unknown as readonly Hydration.DehydratedAtom[];

/** Every value the reader rendered in the browser, in order. */
export const providerSeedSeen: number[] = [];
