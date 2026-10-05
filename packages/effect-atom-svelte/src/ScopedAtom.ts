/**
 * Atoms scoped to a component subtree.
 *
 * @since 0.1.0
 */
import type { Atom } from "effect/reactivity";
import { createContext } from "svelte";

/**
 * Marks a value as a `ScopedAtom`: every scoped atom has this key, set to this same string, as
 * Effect's own types carry a type id.
 *
 * @stability unstable
 * @since 0.1.0
 * @category type ids
 */
export const TypeId = "~effect-atom-svelte/ScopedAtom" as const;

/**
 * An atom created per component subtree. `provide` builds it once in a parent and puts it in
 * context; `use` reads it in descendants.
 *
 * @stability unstable
 * @since 0.1.0
 * @category models
 */
export interface ScopedAtom<A extends Atom.Atom<unknown>, Input = never> {
  readonly [TypeId]: typeof TypeId;
  readonly provide: [Input] extends [never] ? () => A : (input: Input) => A;
  readonly use: () => A;
}

/**
 * Creates a scoped atom from a factory, which runs once per providing component.
 *
 * **Example** (A counter per subtree, started from an input)
 *
 * ```ts
 * import { ScopedAtom } from "effect-atom-svelte";
 * import { Atom } from "effect/reactivity";
 *
 * export const Counter = ScopedAtom.make((start: number) => Atom.make(start));
 * // A parent's script calls Counter.provide(0); descendants call Counter.use()
 * ```
 *
 * @stability unstable
 * @since 0.1.0
 * @category constructors
 */
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
