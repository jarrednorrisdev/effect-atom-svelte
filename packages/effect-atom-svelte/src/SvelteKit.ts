/**
 * SvelteKit `handleError` hooks that keep an Effect error's `_tag`, so a `<svelte:boundary>`
 * `failed` snippet can tell typed errors apart. Import them from `effect-atom-svelte/sveltekit`.
 *
 * The module does not import SvelteKit: the hooks take the fields of SvelteKit's input they read
 * and return the fields they set, so they type-check against `HandleClientError` and
 * `HandleServerError` once `App.Error` declares `tag?: string`. In SvelteKit 2, whose `App.Error`
 * requires a message, they are typed to return one when there is no `kind`, as they then always
 * set one.
 *
 * @since 0.1.0
 */

/**
 * The part of SvelteKit's `handleError` input that the hooks read. In SvelteKit 3, `kind` is
 * `"unknown"` for errors thrown by your code, `"app"` for `error(...)`, `"framework"` for
 * SvelteKit's own errors (such as 404s) and, on the server, `"validation"` for invalid remote
 * function arguments. SvelteKit 2 passes no `kind`, so the hooks treat every error as `"unknown"`,
 * and use the `message` it passes instead when they set none.
 *
 * @stability unstable
 * @since 0.1.0
 * @category models
 */
export interface CaughtError {
  readonly kind?: string | undefined;
  readonly error: unknown;
  readonly issues?: unknown;
  /** SvelteKit 2's message for the error, read only when there is no `kind`. */
  readonly message?: string | undefined;
}

/**
 * The `App.Error` fields the hooks set. SvelteKit keeps its own `status` and `message` for any
 * field left out.
 *
 * @stability unstable
 * @since 0.1.0
 * @category models
 */
export interface EffectErrorBody {
  readonly message?: string;
  readonly tag?: string;
}

/**
 * SvelteKit 2's `handleError` input: no `kind`, and always a message, which the hooks fall back on.
 *
 * @stability unstable
 * @since 0.2.1
 * @category models
 */
export interface CaughtErrorWithoutKind extends CaughtError {
  readonly kind?: undefined;
  readonly message: string;
}

/**
 * What the hooks return for SvelteKit 2's input: always a message, as its `App.Error` requires one.
 *
 * @stability unstable
 * @since 0.2.1
 * @category models
 */
export interface EffectErrorBodyWithMessage extends EffectErrorBody {
  readonly message: string;
}

const tagOf = (error: unknown): string | undefined =>
  typeof error === "object" &&
  error !== null &&
  "_tag" in error &&
  typeof error._tag === "string"
    ? error._tag
    : undefined;

const messageOf = (error: unknown): string | undefined => {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === "string" ? error : undefined;
};

// SvelteKit 2 expects a message from the hook, and passes the one it would show. SvelteKit 3 fills
// in its own, and warns in development when the hook reads `message`, so it is read only without a
// `kind`.
const fallbackMessage = (input: CaughtError): string | undefined =>
  input.kind === undefined ? input.message : undefined;

// Leaves out empty fields, so SvelteKit's defaults apply, and returns nothing when both are empty.
const body = (
  message: string | undefined,
  tag: string | undefined
): EffectErrorBody | undefined => {
  if (!(message || tag)) {
    return undefined;
  }
  return { ...(message ? { message } : {}), ...(tag ? { tag } : {}) };
};

/**
 * A client `handleError` hook (`src/hooks.client.ts`) that keeps the message and `_tag` of errors
 * thrown by your code, so a boundary's `failed` snippet shows them instead of
 * `{ status: 500, message: "Internal Error" }`. It logs those errors like SvelteKit's default
 * hook, and leaves `error(...)` and SvelteKit's own errors as they are. Made for SvelteKit 3:
 * SvelteKit 2 doesn't say which errors are its own, so there every error is kept and logged.
 *
 * **Example** (Using it as the client hook)
 *
 * ```ts
 * // src/hooks.client.ts
 * export { handleClientError as handleError } from "effect-atom-svelte/sveltekit";
 * ```
 *
 * @stability unstable
 * @since 0.1.0
 * @category hooks
 */
export function handleClientError(
  input: CaughtErrorWithoutKind
): EffectErrorBodyWithMessage;
export function handleClientError(
  input: CaughtError
): EffectErrorBody | undefined;
export function handleClientError(
  input: CaughtError
): EffectErrorBody | undefined {
  // Destructured here, not in the parameter list, so the API reference shows a named parameter.
  const { error, kind = "unknown" } = input;
  if (kind !== "unknown") {
    return undefined;
  }
  console.error(error);
  // `||`, not `??`: an error with an empty message gets SvelteKit 2's instead.
  return body(messageOf(error) || fallbackMessage(input), tagOf(error));
}

/**
 * A server `handleError` hook (`src/hooks.server.ts`) that keeps the `_tag` of errors thrown by
 * your code but not their message, which could expose details of the server to users: the
 * message stays SvelteKit's `"Internal Error"`. It logs errors with `console.error`.
 * Server errors reach a boundary's `failed` snippet when it renders on the server. Made for
 * SvelteKit 3: SvelteKit 2 doesn't say which errors are its own, so there every error is logged.
 *
 * **Example** (Using it as the server hook)
 *
 * ```ts
 * // src/hooks.server.ts
 * export { handleServerError as handleError } from "effect-atom-svelte/sveltekit";
 * ```
 *
 * @stability unstable
 * @since 0.1.0
 * @category hooks
 */
export function handleServerError(
  input: CaughtErrorWithoutKind
): EffectErrorBodyWithMessage;
export function handleServerError(
  input: CaughtError
): EffectErrorBody | undefined;
export function handleServerError(
  input: CaughtError
): EffectErrorBody | undefined {
  const { error, issues, kind = "unknown" } = input;
  if (kind === "validation") {
    console.error("Remote function schema validation failed:", issues);
    return undefined;
  }
  if (kind !== "unknown") {
    return undefined;
  }
  console.error(error);
  return body(fallbackMessage(input), tagOf(error));
}
