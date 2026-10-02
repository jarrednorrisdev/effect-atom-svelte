import type { Atom } from "effect/reactivity";
import { createContext } from "svelte";

export const TypeId = "~effect-atom-svelte/ScopedAtom" as const;

/**
 * An atom created per component subtree. `provide` builds it once in a parent and puts it in
 * context; `use` reads it in descendants.
 */
export interface ScopedAtom<A extends Atom.Atom<unknown>, Input = never> {
  readonly [TypeId]: typeof TypeId;
  readonly provide: [Input] extends [never] ? () => A : (input: Input) => A;
  readonly use: () => A;
}

export const make = <A extends Atom.Atom<unknown>, Input = never>(
  f: (() => A) | ((input: Input) => A)
): ScopedAtom<A, Input> => {
  const [get, set, has] = createContext<A>();
  const provide = (...args: [] | [Input]): A =>
    set(
      args.length === 0
        ? (f as () => A)()
        : (f as (input: Input) => A)(args[0] as Input)
    );
  return {
    [TypeId]: TypeId,
    provide: provide as ScopedAtom<A, Input>["provide"],
    use: () => {
      if (!has()) {
        throw new Error(
          "ScopedAtom used outside of the component that provides it"
        );
      }
      return get();
    },
  };
};
