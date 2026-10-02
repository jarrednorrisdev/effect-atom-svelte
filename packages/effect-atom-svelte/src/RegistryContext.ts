import { BROWSER } from "esm-env";
import { AtomRegistry } from "effect/reactivity";
import { createContext, onDestroy } from "svelte";

export type RegistryOptions = NonNullable<Parameters<typeof AtomRegistry.make>[0]>;

const [getContextRegistry, setContextRegistry, hasContextRegistry] =
  createContext<AtomRegistry.AtomRegistry>();

let browserRegistry: AtomRegistry.AtomRegistry | undefined;

/**
 * Returns the registry from the nearest `provideRegistry` or `RegistryProvider`.
 *
 * In the browser a shared default registry is used when none is provided. On the server there is
 * no default: one module-level registry would share atom state between concurrent requests.
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

/**
 * Puts a registry in context for this component and its children.
 *
 * A registry created here is owned by the component and disposed with it, which on the server
 * means at the end of the request. A registry passed in is left for the caller to dispose.
 */
export const provideRegistry = (
  options: RegistryOptions & { readonly registry?: AtomRegistry.AtomRegistry | undefined } = {}
): AtomRegistry.AtomRegistry => {
  const { registry: provided, ...registryOptions } = options;
  const registry = provided ?? AtomRegistry.make(registryOptions);
  setContextRegistry(registry);
  if (!provided) {
    onDestroy(() => registry.dispose());
  }
  return registry;
};
