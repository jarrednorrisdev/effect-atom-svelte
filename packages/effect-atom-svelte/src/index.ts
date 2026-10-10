/**
 * Svelte 5 bindings for Effect Atom: the hooks, components and registry an app uses, scoped atoms,
 * and Effect Atom's own modules.
 *
 * @since 0.1.0
 */

/**
 * The hooks that read, write and await atoms from components.
 *
 * @stability unstable
 * @since 0.1.0
 * @category hooks
 */
export * from "./Hooks.svelte.ts";

/**
 * The registry that hooks read from, and `provideRegistry` to give a component tree its own.
 *
 * @stability unstable
 * @since 0.1.0
 * @category registry
 */
export * from "./RegistryContext.ts";

/**
 * @stability unstable
 * @since 0.1.0
 * @category components
 */
export { default as HydrationBoundary } from "./HydrationBoundary.svelte";

/**
 * @stability unstable
 * @since 0.1.0
 * @category components
 */
export { default as RegistryProvider } from "./RegistryProvider.svelte";

/**
 * Atoms created once per component subtree and read from context below it.
 *
 * @stability unstable
 * @since 0.1.0
 * @category scoped atoms
 */
export * as ScopedAtom from "./ScopedAtom.ts";

/**
 * Effect Atom's modules, so an app can import everything from one place.
 *
 * @stability unstable
 * @since 0.1.0
 * @category re-exports
 */
export {
  AsyncResult,
  Atom,
  AtomHttpApi,
  AtomRef,
  AtomRegistry,
  AtomRpc,
  Hydration,
  Reactivity,
} from "effect/reactivity";
