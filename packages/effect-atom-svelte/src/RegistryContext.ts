/**
 * The registry that hooks read from, and how a component tree gets one.
 *
 * @since 0.1.0
 */
import { AtomRegistry } from "effect/reactivity";
import { BROWSER } from "esm-env";
import { createContext, onDestroy } from "svelte";

import { setRevalidateOnHydrate } from "./internal/hydration.ts";

/**
 * Options for a registry created by `provideRegistry` or `RegistryProvider`.
 *
 * @stability unstable
 * @since 0.1.0
 * @category models
 */
export type RegistryOptions = NonNullable<
  Parameters<typeof AtomRegistry.make>[0]
>;

const [getContextRegistry, setContextRegistry, hasContextRegistry] =
  createContext<AtomRegistry.AtomRegistry>();

let browserRegistry: AtomRegistry.AtomRegistry | undefined;

/**
 * Returns the registry from the nearest `provideRegistry` or `RegistryProvider`.
 *
 * In the browser a shared default registry is used when none is provided. On the server there is
 * no default: one module-level registry would share atom state between concurrent requests.
 *
 * **Example** (Writing an atom from code that is not reactive)
 *
 * ```ts
 * import { getRegistry } from "effect-atom-svelte";
 * import { countAtom } from "./atoms.ts";
 *
 * const registry = getRegistry(); // while the component initializes
 * const reset = () => registry.set(countAtom, 0);
 * ```
 *
 * @stability unstable
 * @since 0.1.0
 * @category registry
 */
export const getRegistry = (): AtomRegistry.AtomRegistry => {
  if (hasContextRegistry()) {
    return getContextRegistry();
  }
  if (!BROWSER) {
    throw new Error(
      "No AtomRegistry in context. Wrap the app in <RegistryProvider> so each server request gets its own registry."
    );
  }
  browserRegistry ??= AtomRegistry.make();
  return browserRegistry;
};

interface ProvideRegistryCommon {
  /**
   * Fetch server-rendered async atoms again once hydration is done. Defaults to `false`: the
   * server's value is milliseconds old. Children inherit it; the async hooks' own option overrides
   * it. `@effect/atom-react` fetches again for atoms wrapped by `withReactivity` and similar.
   */
  readonly revalidateOnHydrate?: boolean | undefined;
}

/**
 * Provides a registry made elsewhere. The `AtomRegistry.make` options apply only to a registry the
 * provider creates, so they are not accepted here.
 *
 * @stability unstable
 * @since 0.1.0
 * @category models
 */
export interface ProvideExistingRegistry extends ProvideRegistryCommon {
  /** An existing registry to provide instead of creating one. The caller disposes it. */
  readonly registry: AtomRegistry.AtomRegistry;
  readonly initialValues?: undefined;
  readonly scheduleTask?: undefined;
  readonly timeoutResolution?: undefined;
  readonly defaultIdleTTL?: undefined;
}

/**
 * Creates a registry with the `AtomRegistry.make` options, owned by the component.
 *
 * @stability unstable
 * @since 0.1.0
 * @category models
 */
export interface ProvideNewRegistry
  extends RegistryOptions, ProvideRegistryCommon {
  readonly registry?: undefined;
}

/**
 * Options for `provideRegistry` and `RegistryProvider`: an existing `registry`, or the options for
 * a new one, not both (JND-61).
 *
 * @stability unstable
 * @since 0.1.0
 * @category models
 */
export type ProvideRegistryOptions =
  | ProvideExistingRegistry
  | ProvideNewRegistry;

/**
 * Puts a registry in context for this component and its children.
 *
 * A registry created here is owned by the component and disposed with it, which on the server
 * means at the end of the request. A registry passed in is left for the caller to dispose.
 *
 * **Example** (Giving the app a registry from the root layout)
 *
 * ```ts
 * import { provideRegistry } from "effect-atom-svelte";
 *
 * // In src/routes/+layout.svelte: one registry per server request,
 * // disposed of when the request ends
 * provideRegistry();
 * ```
 *
 * @stability unstable
 * @since 0.1.0
 * @category registry
 */
export const provideRegistry = (
  options: ProvideRegistryOptions = {}
): AtomRegistry.AtomRegistry => {
  const {
    defaultIdleTTL,
    initialValues,
    registry: provided,
    revalidateOnHydrate,
    scheduleTask,
    timeoutResolution,
  } = options;
  // Picked one by one, as RegistryProvider passes its props here, children included.
  const registryOptions: RegistryOptions = {
    defaultIdleTTL,
    initialValues,
    scheduleTask,
    timeoutResolution,
  };
  if (
    provided &&
    Object.values(registryOptions).some((value) => value !== undefined)
  ) {
    // The types rule this out; a caller without them would otherwise lose the options silently.
    throw new Error(
      "provideRegistry takes an existing registry or options for a new one, not both. Apply initialValues to the existing registry yourself."
    );
  }
  const registry = provided ?? AtomRegistry.make(registryOptions);
  setContextRegistry(registry);
  if (revalidateOnHydrate !== undefined) {
    setRevalidateOnHydrate(revalidateOnHydrate);
  }
  if (!provided) {
    onDestroy(() => registry.dispose());
  }
  return registry;
};
