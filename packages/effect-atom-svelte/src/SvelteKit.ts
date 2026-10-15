/**
 * SvelteKit helpers. Import them from `effect-atom-svelte/sveltekit`.
 *
 * `handleClientError` and `handleServerError` are `handleError` hooks that keep an Effect error's
 * `_tag`, so a `<svelte:boundary>` `failed` snippet can tell typed errors apart. They take the
 * fields of SvelteKit's input they read and return the fields they set, so they type-check against
 * `HandleClientError` and `HandleServerError` once `App.Error` declares `tag?: string`. In
 * SvelteKit 2, whose `App.Error` requires a message, they are typed to return one when there is no
 * `kind`, as they then always set one.
 *
 * `useUnsavedChangesGuard` asks before leaving a page with a dirty form.
 *
 * @since 0.1.0
 */
/// <reference types="@sveltejs/kit" />
import { beforeNavigate, goto } from "$app/navigation";
import { Effect } from "effect";

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

const tagOf = (error: unknown): string | undefined => {
  if (typeof error !== "object" || error === null || !("_tag" in error)) {
    return undefined;
  }
  return typeof error._tag === "string" ? error._tag : undefined;
};

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
  const fields: { message?: string; tag?: string } = {};
  if (message !== undefined && message !== "") {
    fields.message = message;
  }
  if (tag !== undefined && tag !== "") {
    fields.tag = tag;
  }
  return fields.message === undefined && fields.tag === undefined
    ? undefined
    : fields;
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
  // An error with an empty message gets SvelteKit 2's instead.
  const message = messageOf(error);
  return body(
    message === undefined || message === "" ? fallbackMessage(input) : message,
    tagOf(error)
  );
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

/**
 * Options for `useUnsavedChangesGuard`.
 *
 * @stability unstable
 * @since 0.4.0
 * @category models
 */
export interface UnsavedChangesGuardOptions {
  /**
   * Asks whether to leave and lose the changes, resolving `true` to leave. Called for links,
   * `goto`, form navigations and the back and forward buttons. Closing the tab, reloading and
   * typing a URL show the browser's own dialog instead, as a page can't show its own then.
   */
  readonly confirm: () => boolean | Promise<boolean>;
}

// Waits for the next popstate, or a second, should none come.
const nextPopState = (): Promise<unknown> =>
  Effect.runPromise(
    Effect.callback<undefined>((resume) => {
      const done = () => {
        resume(Effect.undefined);
      };
      addEventListener("popstate", done, { once: true });
      return Effect.sync(() => {
        removeEventListener("popstate", done);
      });
    }).pipe(Effect.timeoutOption("1 second"))
  );

// How long a "yes" lets the retried navigation through. The retry reaches beforeNavigate at once;
// a navigation that never does, such as a link to a download, doesn't leave a bypass behind.
const bypassFor = 2000;

/**
 * Asks before the user navigates away from a page whose form is dirty, using SvelteKit's
 * `beforeNavigate`. Call it while a component initializes, with any object that has `dirty`, such
 * as a form instance from `useForm`.
 *
 * While the form is dirty, a navigation is cancelled and `confirm` asked; on yes it is retried, and
 * the retry goes through. Closing the tab, reloading or typing a URL show the browser's own dialog
 * instead. SvelteKit doesn't call `beforeNavigate` for back and forward over shallow history entries
 * (from `pushState` or a hash change) or for links to a hash on the same page, so those aren't
 * guarded.
 *
 * **Example** (Asking before leaving an edit page)
 *
 * ```ts
 * import { useForm } from "effect-atom-svelte";
 * import { useUnsavedChangesGuard } from "effect-atom-svelte/sveltekit";
 *
 * const form = useForm(EditProject, { id, initialValues, submit });
 * useUnsavedChangesGuard(form, {
 *   confirm: () => window.confirm("Leave without saving your changes?"),
 * });
 * ```
 *
 * @see {@link https://atom.jarrednorris.dev/forms | Forms}
 * @stability unstable
 * @since 0.4.0
 * @category forms
 */
export const useUnsavedChangesGuard = (
  form: { readonly dirty: boolean },
  options: UnsavedChangesGuardOptions
): void => {
  // The retry of a navigation the user agreed to: where it goes, whether it unloads the page, and
  // until when to expect it.
  let retry:
    | {
        readonly href: string;
        readonly unloads: boolean;
        readonly until: number;
      }
    | undefined;
  beforeNavigate((navigation) => {
    // Let the retry through, once. Any other navigation is asked about as usual.
    if (
      retry !== undefined &&
      // oxlint-disable-next-line effecttsgo/global-date -- SvelteKit calls beforeNavigate synchronously, outside any Effect program
      retry.until > Date.now() &&
      (navigation.type === "leave"
        ? retry.unloads
        : navigation.to?.url.href === retry.href)
    ) {
      retry = undefined;
      return;
    }
    if (!form.dirty) {
      return;
    }
    // Closing the tab, reloading or typing a URL: cancelling shows the browser's dialog, and no
    // code of ours can run before the page goes.
    navigation.cancel();
    const { to } = navigation;
    if (navigation.type === "leave" || to === null) {
      return;
    }
    // Cancelling back or forward makes SvelteKit undo the move with history.go, which finishes with
    // a popstate. A retry before then would be lost to it, so the retry waits for it.
    const undone = navigation.type === "popstate" ? nextPopState() : undefined;
    // oxlint-disable-next-line effecttsgo/async-function -- awaits the app's confirm, which may return a Promise, from SvelteKit's beforeNavigate, outside any Effect program
    void (async () => {
      if (!(await options.confirm())) {
        return;
      }
      retry = {
        href: to.url.href,
        unloads: navigation.type !== "popstate" && navigation.willUnload,
        // oxlint-disable-next-line effecttsgo/global-date -- compared with Date.now in beforeNavigate, outside any Effect program
        until: Date.now() + bypassFor,
      };
      if (navigation.type === "popstate") {
        await undone;
        history.go(navigation.delta);
      } else if (navigation.willUnload) {
        // An external link, or one SvelteKit hands to the browser: goto can't follow it. The page
        // unloading fires a "leave", which the bypass lets through.
        location.href = to.url.href;
      } else {
        // SvelteKit 3 warns in dev whenever the `replaceState` key is there, even false, so it is
        // passed only when true.
        await goto(
          to.url,
          to.url.href === location.href
            ? // oxlint-disable-next-line typescript/no-deprecated -- the peer range includes SvelteKit 2, whose goto has no `replace`, only `replaceState`
              { replaceState: true }
            : {}
        );
      }
    })();
  });
};
