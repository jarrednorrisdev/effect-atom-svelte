import { Effect, Schema } from "effect";
import { AsyncResult, Atom } from "effect/reactivity";
import type { Hydration } from "effect/reactivity";

let runs = 0;

/**
 * A serializable async atom a RegistryProvider gives an initial value. Each run says where it ran
 * and how many runs there have been.
 */
export const initialSeedAtom = Atom.make(
  Effect.sync(() => {
    runs += 1;
    return `${typeof window === "undefined" ? "server" : "browser"} ${runs}`;
  })
).pipe(
  Atom.serializable({
    key: "initial-seed",
    schema: AsyncResult.Schema({ success: Schema.String }),
  })
);

export const initialSeedValue = AsyncResult.success("initial");

/** What a load function would dehydrate for the atom. */
export const initialSeedState = [
  {
    dehydratedAt: 0,
    key: "initial-seed",
    value: initialSeedAtom[Atom.SerializableTypeId].encode(
      AsyncResult.success("from the boundary")
    ),
    "~effect/reactivity/Hydration/DehydratedAtom": true,
  },
] as unknown as readonly Hydration.DehydratedAtom[];
