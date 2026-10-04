// The registry provider's default for revalidateOnHydrate, read by the async hooks. Internal: not
// exported from the package.
import { createContext } from "svelte";

const [getDefault, setDefault, hasDefault] = createContext<boolean>();

/** Sets the default for this component's children. Call during component init. */
export const setRevalidateOnHydrate = (value: boolean): void => {
  setDefault(value);
};

/**
 * Whether a hook runs its atom again once the page has hydrated: its own option, else the nearest
 * provider's, else no (JND-19). Call during component init.
 */
export const revalidatesOnHydrate = (option: boolean | undefined): boolean =>
  option ?? (hasDefault() ? getDefault() : false);
