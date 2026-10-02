/**
 * SvelteKit `handleError` hooks that keep an Effect error's `_tag`, so a `<svelte:boundary>`
 * `failed` snippet can tell typed errors apart. Import them from `effect-atom-svelte/sveltekit`.
 *
 * The module does not import SvelteKit: the hooks take the fields of SvelteKit's input they read
 * and return the fields they set, so they type-check against `HandleClientError` and
 * `HandleServerError` once `App.Error` declares `tag?: string`.
 *
 * @since 0.1.0
 */

/**
 * The part of SvelteKit's `handleError` input that the hooks read. `kind` is `"unknown"` for
 * errors thrown by your code, `"app"` for `error(...)`, `"framework"` for SvelteKit's own errors
 * (such as 404s) and, on the server, `"validation"` for invalid remote function arguments.
 *
 * @stability unstable
 * @since 0.1.0
 * @category models
 */
export interface CaughtError {
  readonly kind: string;
  readonly error: unknown;
  readonly issues?: unknown;
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
 * hook, and leaves `error(...)` and SvelteKit's own errors as they are.
 *
 * @example
 * ```ts
 * // src/hooks.client.ts
 * export { handleClientError as handleError } from "effect-atom-svelte/sveltekit";
 * ```
 *
 * @stability unstable
 * @since 0.1.0
 * @category hooks
 */
export const handleClientError = ({
  error,
  kind,
}: CaughtError): EffectErrorBody | undefined => {
  if (kind !== "unknown") {
    return undefined;
  }
  console.error(error);
  return body(messageOf(error), tagOf(error));
};

/**
 * A server `handleError` hook (`src/hooks.server.ts`) that keeps the `_tag` of errors thrown by
 * your code but not their message, which could expose details of the server to users: the
 * message stays SvelteKit's `"Internal Error"`. It logs errors like SvelteKit's default hook.
 * Server errors reach a boundary's `failed` snippet when it renders on the server.
 *
 * @example
 * ```ts
 * // src/hooks.server.ts
 * export { handleServerError as handleError } from "effect-atom-svelte/sveltekit";
 * ```
 *
 * @stability unstable
 * @since 0.1.0
 * @category hooks
 */
export const handleServerError = ({
  error,
  issues,
  kind,
}: CaughtError): EffectErrorBody | undefined => {
  if (kind === "validation") {
    console.error("Remote function schema validation failed:", issues);
    return undefined;
  }
  if (kind !== "unknown") {
    return undefined;
  }
  console.error(error);
  return body(undefined, tagOf(error));
};
