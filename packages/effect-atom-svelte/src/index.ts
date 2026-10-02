/**
 * Svelte 5 bindings for Effect Atom.
 *
 * @since 0.1.0
 */

/**
 * @stability unstable
 * @since 0.1.0
 * @category hooks
 */
export * from "./Hooks.svelte.ts";

/**
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
 * @stability unstable
 * @since 0.1.0
 * @category scoped atoms
 */
export * as ScopedAtom from "./ScopedAtom.ts";

/**
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
} from "effect/reactivity";
