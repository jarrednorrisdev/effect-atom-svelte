/**
 * Atoms scoped to a component subtree.
 *
 * @since 0.1.0
 */
import type { Atom } from "effect/reactivity";
import { createContext } from "svelte";

// A const and a type of the same name, as in Effect's modules.
/* oxlint-disable eslint/no-redeclare */
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
 * The type of `TypeId`.
 *
 * @stability unstable
 * @since 0.1.0
 * @category type ids
 */
export type TypeId = typeof TypeId;
/* oxlint-enable eslint/no-redeclare */

/**
 * An atom created per component subtree. `provide` builds it once in a parent and puts it in
 * context; `use` reads it in descendants. `provide` takes the factory's input, which may be left
 * out when the factory's input is optional.
 *
 * @stability unstable
 * @since 0.1.0
 * @category models
 */
export interface ScopedAtom<A extends Atom.Atom<unknown>, Input = never> {
  readonly [TypeId]: TypeId;
  readonly provide: [Input] extends [never]
    ? () => A
    : undefined extends Input
      ? (input?: Input) => A
      : (input: Input) => A;
  readonly use: () => A;
}

/**
 * Options for `ScopedAtom.make`.
 *
 * @stability unstable
 * @since 0.1.0
 * @category models
 */
export interface MakeOptions {
  /** A name for error messages, such as the one thrown when `use` finds no provider. */
  readonly name?: string | undefined;
}

/**
 * Creates a scoped atom from a factory, which runs once per providing component.
 *
 * Each provider gets its own atom, so a factory that adds `Atom.serializable` with a fixed key
 * gives every copy the same key: once two providers are on a page, reading them with
 * `useAtomResult` or `useAtomSuspense` throws, as two different atoms share the serialization
 * key. Put the input in the key, or leave scoped atoms unserialized.
 *
 * **Example** (A counter per subtree, started from an input)
 *
 * ```ts
 * import { ScopedAtom } from "effect-atom-svelte";
 * import { Atom } from "effect/reactivity";
 *
 * export const Counter = ScopedAtom.make((start: number) => Atom.make(start), {
 *   name: "Counter",
 * });
 * // A parent's script calls Counter.provide(0); descendants call Counter.use()
 * ```
 *
 * @stability unstable
 * @since 0.1.0
 * @category constructors
 */
export const make = <A extends Atom.Atom<unknown>, Input = never>(
  f: (() => A) | ((input: Input) => A),
  options?: MakeOptions
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
        const name = options?.name;
        const which = name ? `ScopedAtom "${name}"` : "ScopedAtom";
        const call = name ? `${name}.provide()` : "its provide()";
        throw new Error(
          `${which} used outside of the component that provides it. Call ${call} in a parent component's script.`
        );
      }
      return get();
    },
  };
};
