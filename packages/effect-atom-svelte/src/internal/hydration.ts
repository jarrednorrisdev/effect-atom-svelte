// Hydration helpers shared by the hooks: the registry provider's default for revalidateOnHydrate,
// and how a seed is encoded on the server and read in the browser. Internal: not exported from the
// package.
import { Cause, Schema } from "effect";
import { AsyncResult } from "effect/reactivity";
import { DEV } from "esm-env";
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

/**
 * What the server sends for a result it doesn't pass on, so the browser computes the atom itself.
 * An encoded `AsyncResult` is an object, never `null`.
 */
const noSeed = null;

/**
 * Encodes the server's result for the page, or returns the no-seed marker for a result that must
 * not or cannot travel:
 *
 * - A failure with a defect or an interruption. `Schema.Defect` keeps a defect's name, message and
 *   cause, which can hold details of the server (a connection string, say) that `handleServerError`
 *   keeps from the visitor. Typed errors are part of the atom's schema, so they are sent.
 * - A result the schema can't encode, as Effect's `Hydration.dehydrate` skips it, rather than
 *   failing the whole render. Development builds warn.
 */
export const encodeSeed = (
  key: string,
  encode: (value: AsyncResult.AsyncResult<unknown, unknown>) => unknown,
  result: AsyncResult.AsyncResult<unknown, unknown>
): unknown => {
  if (
    AsyncResult.isFailure(result) &&
    (Cause.hasDies(result.cause) || Cause.hasInterrupts(result.cause))
  ) {
    return noSeed;
  }
  try {
    return encode(result);
  } catch (error) {
    if (!Schema.isSchemaError(error)) {
      throw error;
    }
    if (DEV) {
      console.warn(
        `effect-atom-svelte: the result of the serializable atom "${key}" doesn't encode with its schema, so it isn't sent to the browser, which computes the atom again.`,
        error
      );
    }
    return noSeed;
  }
};

/** The server's result, decoded, or undefined when the server sent none. */
export const decodeSeed = (
  value: unknown,
  decode: (value: unknown) => unknown
): unknown => (value === noSeed ? undefined : decode(value));

/**
 * Whether a seed is still waiting, as a stream's result is between its values. The browser runs
 * the atom again from it, as the server's run ended with the render.
 */
export const isWaiting = (value: unknown): boolean =>
  AsyncResult.isAsyncResult(value) && value.waiting;
