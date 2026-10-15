/**
 * Forms driven by one Effect Schema. `Form.make` defines a form from a Schema whose encoded side is
 * what inputs hold and whose decoded side is what a submit sends; `useForm` creates an instance in
 * a component, and `Form.instance` creates one without Svelte. The module is headless: it gives
 * values, errors and element attributes, and no components.
 *
 * @since 0.4.0
 */
import { Duration } from "effect";
import type { Exit, Option, Schema, SchemaIssue } from "effect";
import { AtomRegistry } from "effect/reactivity";
import type { AsyncResult, Atom } from "effect/reactivity";

import type { AtomInput } from "./Hooks.svelte.ts";
import type { Constraints as InternalConstraints } from "./internal/form/constraints.ts";
import { engineOf, initialGetter } from "./internal/form/engineOf.ts";
import type { Definition } from "./internal/form/types.ts";
import { FormValidationError } from "./internal/form/validationError.ts";

// A const and a type of the same name, as in Effect's modules.
/* oxlint-disable eslint/no-redeclare */
/**
 * Marks a value as a form definition: every definition has this key, set to this same string.
 *
 * @stability unstable
 * @since 0.4.0
 * @category type ids
 */
export const TypeId = "~effect-atom-svelte/Form" as const;

/**
 * The type of `TypeId`.
 *
 * @stability unstable
 * @since 0.4.0
 * @category type ids
 */
export type TypeId = typeof TypeId;
/* oxlint-enable eslint/no-redeclare */

/**
 * When a field's error shows: as the user types (`"input"`), when they leave it (`"blur"`), or only
 * when the form is submitted (`"submit"`). The Schema checks every change whatever the timing, so
 * `valid` and `field.issue` are always current; the timing only decides when `field.error` shows.
 *
 * @stability unstable
 * @since 0.4.0
 * @category models
 */
export type Timing = "submit" | "blur" | "input";

/**
 * A form definition: a Schema and the settings every instance shares. It holds no state, so it can
 * live in a module beside the atoms.
 *
 * @stability unstable
 * @since 0.4.0
 * @category models
 */
export interface Form<S extends Schema.Top> {
  readonly [TypeId]: TypeId;
  readonly schema: S;
  /** @internal */
  readonly definition: Definition;
}

/**
 * The values a form's inputs hold: its Schema's encoded side.
 *
 * @stability unstable
 * @since 0.4.0
 * @category models
 */
export type Encoded<F extends Form<Schema.Top>> = F["schema"]["Encoded"];

/**
 * What a form's values decode to, and a submit sends: its Schema's decoded side.
 *
 * @stability unstable
 * @since 0.4.0
 * @category models
 */
export type Decoded<F extends Form<Schema.Top>> = F["schema"]["Type"];

/**
 * Options for `Form.make`: the settings every instance of the form shares.
 *
 * @stability unstable
 * @since 0.4.0
 * @category models
 */
export interface MakeOptions {
  /**
   * A name for the form, used in its atoms' labels, such as `SignUp.values`, which the devtools
   * show. The devtools' Vite plugin fills it in from the variable a form is declared as.
   */
  readonly name?: string | undefined;
  /** When a field's error first shows. Defaults to `"blur"`. */
  readonly validateOn?: Timing | undefined;
  /**
   * When it updates after the field has shown an error, or once the form has been submitted.
   * Defaults to `"input"`.
   */
  readonly revalidateOn?: Timing | undefined;
  /** How long to wait after a change before validating. Defaults to none. */
  readonly debounce?: Duration.Input | undefined;
  /** A message for an issue that has no `message` annotation, or `undefined` for Effect's own. */
  readonly leafHook?:
    | ((issue: SchemaIssue.Leaf) => string | undefined)
    | undefined;
  /** A message for a failed check that has no `message` annotation, or `undefined` for Effect's. */
  readonly checkHook?:
    | ((issue: SchemaIssue.Filter) => string | undefined)
    | undefined;
}

/**
 * Options for `Form.make` with a runtime, for a Schema whose checks need services.
 *
 * @stability unstable
 * @since 0.4.0
 * @category models
 */
export interface MakeOptionsWithRuntime<R, ER> extends MakeOptions {
  /** The runtime validation runs on, built with `Atom.runtime(layer)`. */
  readonly runtime: Atom.AtomRuntime<R, ER>;
}

const definitionOf = (
  schema: Schema.Top,
  options: MakeOptions & { readonly runtime?: unknown }
): Definition => ({
  checkHook: options.checkHook,
  debounce:
    options.debounce === undefined ? 0 : Duration.toMillis(options.debounce),
  leafHook: options.leafHook,
  name: options.name,
  revalidateOn: options.revalidateOn ?? "input",
  runtime: options.runtime,
  schema,
  validateOn: options.validateOn ?? "blur",
});

/**
 * Defines a form from a Schema. Decoding always runs as an Effect, with every issue reported, so
 * checks that call services work when a runtime provides them. A message comes from the Schema's
 * `message` annotation first, then from `leafHook` or `checkHook`, then from Effect's default.
 *
 * **Example** (Defining a login form)
 *
 * ```ts
 * import { Schema } from "effect";
 * import { Form } from "effect-atom-svelte";
 *
 * export const Login = Form.make(
 *   Schema.Struct({
 *     email: Schema.String.check(
 *       Schema.isPattern(/^\S+@\S+\.\S+$/u, {
 *         message: "Enter an email address",
 *       })
 *     ),
 *     password: Schema.String.check(
 *       Schema.isMinLength(8, {
 *         message: "At least 8 characters",
 *       })
 *     ),
 *   })
 * );
 * ```
 *
 * @see {@link https://atom.jarrednorris.dev/forms | Forms}
 * @stability unstable
 * @since 0.4.0
 * @category constructors
 */
export function make<
  S extends Schema.Top & { readonly DecodingServices: never },
>(schema: S, options?: MakeOptions): Form<S>;
export function make<S extends Schema.Top, R, ER>(
  schema: S & ([S["DecodingServices"]] extends [R] ? unknown : never),
  options: MakeOptionsWithRuntime<R, ER>
): Form<S>;
export function make(
  schema: Schema.Top,
  options: MakeOptions & { readonly runtime?: unknown } = {}
): Form<Schema.Top> {
  return {
    [TypeId]: TypeId,
    definition: definitionOf(schema, options),
    schema,
  };
}

/**
 * Whether a value is a form definition from `Form.make`.
 *
 * @stability unstable
 * @since 0.4.0
 * @category guards
 */
export const isForm = (u: unknown): u is Form<Schema.Top> =>
  typeof u === "object" && u !== null && TypeId in u;

// ── paths ─────────────────────────────────────────────────────────────────────────────────────

type Depth = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8];

type Scalar =
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined
  | Date
  | ((...args: readonly never[]) => unknown);

/**
 * Every path into `T`, as a tuple of object keys and array indexes:
 * `["email"]`, `["items", 0, "street"]`. For a union, the paths of every member.
 *
 * @stability unstable
 * @since 0.4.0
 * @category models
 */
export type Path<T, D extends number = 8> = [D] extends [never]
  ? never
  : T extends Scalar
    ? never
    : T extends readonly (infer Item)[]
      ?
          | readonly [number]
          | readonly [number, ...Path<NonNullable<Item>, Depth[D]>]
      : T extends object
        ? {
            [K in keyof T & string]-?:
              | readonly [K]
              | readonly [K, ...Path<NonNullable<T[K]>, Depth[D]>];
          }[keyof T & string]
        : never;

/**
 * The value at path `P` in `T`. For a union, the value in each member that has the path. Below an
 * optional parent it may also be `undefined`, as it is while the parent is.
 *
 * @stability unstable
 * @since 0.4.0
 * @category models
 */
export type At<T, P> = P extends readonly []
  ? T
  : P extends readonly [infer Head, ...infer Rest]
    ? T extends unknown
      ? T extends readonly (infer Item)[]
        ? Head extends number
          ? At<Rest extends readonly [] ? Item : NonNullable<Item>, Rest>
          : never
        : Head extends keyof T
          ? Rest extends readonly []
            ? T[Head]
            :
                | At<NonNullable<T[Head]>, Rest>
                | (undefined extends T[Head] ? undefined : never)
          : never
      : never
    : never;

/**
 * The top-level keys of `T`, of every member for a union: the short form of a path.
 *
 * @stability unstable
 * @since 0.4.0
 * @category models
 */
export type Key<T> = T extends unknown
  ? T extends readonly unknown[] | Scalar
    ? never
    : T extends object
      ? keyof T & string
      : never
  : never;

type ItemOf<V> = NonNullable<V> extends readonly (infer Item)[] ? Item : never;

/**
 * A path as the form reports it, such as in `errors`: object keys and array indexes.
 *
 * @stability unstable
 * @since 0.4.0
 * @category models
 */
export type AnyPath = readonly (string | number)[];

// ── fields ────────────────────────────────────────────────────────────────────────────────────

/**
 * HTML input constraints read from a field's Schema checks: `minlength` from `isMinLength` and
 * `isNonEmpty`, `maxlength` from `isMaxLength`, both from `isBetweenLength`, `min` and `max` from
 * `isGreaterThanOrEqualTo`, `isLessThanOrEqualTo` and `isBetween`, `pattern` from an `isPattern`
 * anchored with `^` and `$`, with no flags but `u` or `v` (an HTML pattern must match the whole value, a
 * Schema pattern anywhere in it), and `required`
 * where the Schema rejects an empty string. Other checks set nothing.
 *
 * @stability unstable
 * @since 0.4.0
 * @category models
 */
export type Constraints = InternalConstraints;

/**
 * The attributes `field.attrs` spreads on a native input.
 *
 * @stability unstable
 * @since 0.4.0
 * @category models
 */
export interface FieldAttrs {
  readonly name: string;
  readonly id: string;
  readonly "aria-invalid": true | undefined;
  readonly "aria-describedby": string | undefined;
  readonly onblur: () => void;
}

/**
 * One field of a form instance. Every property is reactive in a component. `value` can be
 * assigned, so `bind:value={field.value}` works; an assignment counts as input for validation
 * timing, and a change clears a server or manual error on the field and the form-level error.
 *
 * @stability unstable
 * @since 0.4.0
 * @category models
 */
export interface Field<V> {
  value: V;
  /** The error to show: a schema error once the field's timing reveals it, or a server one. */
  readonly error: string | undefined;
  /**
   * The latest check's message for the field, shown or not: the Schema checks every change, and
   * `error` waits for the field's timing. For a live checklist, or to see what the timing hides.
   */
  readonly issue: string | undefined;
  /** Whether the user has left the field. `useForm`'s `attrs.onblur` sets it. */
  touched: boolean;
  /** Whether the value differs from the initial value. */
  readonly dirty: boolean;
  /**
   * Whether the form's validation is running or waiting for its debounce: the whole form's flag,
   * the same on every field, as one run checks every field.
   */
  readonly validating: boolean;
  /** The field's element id, from the instance's `id`. */
  readonly id: string;
  /** The id for the element that shows `error`, which `attrs` points `aria-describedby` at. */
  readonly errorId: string;
  /** The `name` attribute: the path joined with dots, such as `items.0.qty`. */
  readonly name: string;
  /** Where the field is now. An array item's field follows the item when it moves. */
  readonly path: AnyPath;
  /**
   * Attributes to spread on a native input: `name`, `id`, `aria-invalid` while `error` is set,
   * `aria-describedby` pointing at `errorId` while it is, and an `onblur` that marks the field
   * touched.
   */
  readonly attrs: FieldAttrs;
  readonly constraints: Constraints;
  /** What leaving the field does, for a custom control that has no blur event. */
  readonly blur: () => void;
}

/**
 * One item of an array field, with a key that stays with it when items move.
 *
 * @stability unstable
 * @since 0.4.0
 * @category models
 */
export interface ArrayItem<I> {
  /** Stays with the item: use it to key an `{#each}` block. */
  readonly key: number;
  readonly index: number;
  /** The item's own fields, for an item that is an object. */
  readonly fields: Group<I>;
  /** The item itself as a field, for an item that is a single value. */
  readonly field: Field<I>;
}

/**
 * An array in a form. Its operations move each item's errors and touched state with the item.
 *
 * @stability unstable
 * @since 0.4.0
 * @category models
 */
export interface ArrayField<I> {
  readonly items: readonly ArrayItem<I>[];
  /** An error on the array itself, such as from a check on its length. */
  readonly error: string | undefined;
  readonly path: AnyPath;
  /** Adds an item at the end, with a new key and no errors or touched state. */
  readonly append: (item: I) => void;
  /** Removes the item at `index`, and its errors and touched state. Out of range does nothing. */
  readonly remove: (index: number) => void;
  /**
   * Moves the item at index `from` to index `to`, shifting the items between; its errors and
   * touched state go with it. Either index out of range does nothing.
   */
  readonly move: (from: number, to: number) => void;
  /** Puts a new item at `index`: the old item's errors and touched state go with it. */
  readonly replace: (index: number, item: I) => void;
}

/**
 * Fields under one path. A component that edits a part of a form takes a `Group` of that part's
 * shape, and any form with that shape somewhere passes `form.at(path)`.
 *
 * @stability unstable
 * @since 0.4.0
 * @category models
 */
export interface Group<T> {
  readonly path: AnyPath;
  /** A field by top-level key, or by path: `field("email")`, `field(["items", 0, "qty"])`. */
  readonly field: {
    <K extends Key<T>>(key: K): Field<At<T, readonly [K]>>;
    <const P extends Path<T>>(path: P): Field<At<T, P>>;
  };
  /** An array field, by top-level key or by path. */
  readonly array: {
    <K extends Key<T>>(key: K): ArrayField<ItemOf<At<T, readonly [K]>>>;
    <const P extends Path<T>>(path: P): ArrayField<ItemOf<At<T, P>>>;
  };
  /** The fields under a key or path, as a group to hand to a component. */
  readonly at: {
    <K extends Key<T>>(key: K): Group<NonNullable<At<T, readonly [K]>>>;
    <const P extends Path<T>>(path: P): Group<NonNullable<At<T, P>>>;
  };
}

// ── the instance ──────────────────────────────────────────────────────────────────────────────

/**
 * Errors to put on a form, from `mapError` or `setErrors`: by top-level field, by path, and
 * form-level.
 *
 * @stability unstable
 * @since 0.4.0
 * @category models
 */
export interface Errors<T> {
  readonly fields?:
    | Readonly<Partial<Record<Key<T>, string | undefined>>>
    | undefined;
  readonly paths?: readonly (readonly [Path<T>, string])[] | undefined;
  readonly form?: string | undefined;
}

/**
 * One error as `form.errors` lists it.
 *
 * @stability unstable
 * @since 0.4.0
 * @category models
 */
export interface ErrorEntry {
  /** Empty for a form-level error. */
  readonly path: AnyPath;
  readonly message: string;
}

/* oxlint-disable eslint/no-redeclare */
/**
 * Why `submit` didn't call the submit atom: the values didn't decode. `errors` lists what showed.
 * Its `_tag` is `"FormValidationError"`, for `Effect.catchTag`.
 *
 * @stability unstable
 * @since 0.4.0
 * @category errors
 */
export const ValidationError = FormValidationError;

/**
 * The type of `ValidationError`.
 *
 * @stability unstable
 * @since 0.4.0
 * @category errors
 */
export type ValidationError = FormValidationError;
/* oxlint-enable eslint/no-redeclare */

/**
 * The attributes `form.attrs` spreads on a `<form>`: `novalidate`, so the browser's own bubbles
 * never compete with the form's errors, and an `onsubmit` that prevents the browser's submit,
 * submits the form, and moves focus to the first field with an error when validation fails.
 *
 * @stability unstable
 * @since 0.4.0
 * @category models
 */
export interface FormAttrs {
  readonly novalidate: true;
  readonly onsubmit: (event: Event) => void;
}

/**
 * A form instance: its values, state and actions. Every property is reactive in a component.
 * `submitting` and `submitResult` belong to this instance, not to the submit atom, which other
 * instances may share.
 *
 * @stability unstable
 * @since 0.4.0
 * @category models
 */
export interface Instance<T, D, A, E, Args> extends Group<T> {
  /** The current values, encoded, as the inputs hold them. */
  readonly values: T;
  /**
   * What `dirty` compares the values with: `initialValues`, or the values of the last successful
   * submit, which become the initial values.
   */
  readonly initialValues: T;
  /** Whether the values differ from `initialValues`. */
  readonly dirty: boolean;
  /**
   * Whether the form can be submitted as it stands: the latest values have been checked and
   * decode, and no external error (from `mapError` or `setErrors`) is set. It is false while the
   * Schema fails, while a check is running or waiting for its debounce, and while any external
   * error is set, whether or not an error shows yet.
   */
  readonly valid: boolean;
  /** Whether validation is running or waiting for its debounce. */
  readonly validating: boolean;
  /** Whether a submit is waiting for the submit atom's result. */
  readonly submitting: boolean;
  /**
   * The last submit's result, holding only failures `mapError` didn't claim. A validation that
   * couldn't run at all, such as when the form's runtime failed to build, ends here as a defect.
   */
  readonly submitResult: AsyncResult.AsyncResult<A, E>;
  /**
   * A form-level error, on no field: `mapError`'s or `setErrors`' `form`, which shows at once and
   * clears on any change to the values, at the next submit or on reset; or an error from a check on the whole Struct
   * that gives no `path`, which shows only after `submit` or a `validate()` of the whole form.
   */
  readonly rootError: string | undefined;
  /**
   * Every error on show, for an error summary: the form-level one first, then the fields' in the
   * Schema's order, which may not be the page's.
   */
  readonly errors: readonly ErrorEntry[];
  /** How many times `submit` has been called since the last reset, whatever the outcome. */
  readonly submitCount: number;
  /** How many times `validate` has been called since the last reset. */
  readonly validationCount: number;
  /** The values of the last successful submit, encoded and decoded. */
  readonly lastSubmitted: Option.Option<{
    readonly encoded: T;
    readonly decoded: D;
  }>;
  /** Whether the values differ from the last successful submit's. */
  readonly dirtySinceSubmit: boolean;
  /** Attributes to spread on the `<form>` element: see `FormAttrs`. */
  readonly attrs: FormAttrs;
  /**
   * Decodes the values and, when they decode, writes the submit atom and waits for its result. A
   * call while a submit runs gets that submit's result. A submit that settles after a reset doesn't
   * touch the fresh form. Instances that submit to the same `Atom.fn` share its one result: if
   * another instance writes it while this submit runs, this submit resolves with the other's
   * result, so give each instance its own atom.
   */
  readonly submit: (
    ...args: [Args] extends [undefined] ? [] : [args: Args]
  ) => Promise<Exit.Exit<A, E | ValidationError>>;
  /**
   * Shows the Schema's errors at and under these paths (every path by default) and resolves
   * whether they passed: no Schema error and no external error (from `mapError` or `setErrors`) at
   * or under any of them. A whole-form `validate()` also counts the form-level error; a call with
   * paths doesn't.
   */
  readonly validate: (
    paths?: readonly (Key<T> | Path<T>)[]
  ) => Promise<boolean>;
  /**
   * Sets several values at once. Not counted as input on any field, so an untouched field's error
   * waits for its own timing; a touched field whose check it breaks shows its error at once, as
   * after another field's change. Like any change, it clears external errors where values changed.
   */
  readonly setValues: (values: T | ((previous: T) => T)) => void;
  /**
   * Back to `initialValues`, or to `values`, which become the initial values. Clears
   * `lastSubmitted`, `submitResult`, touched state, every error and both counts. After a successful
   * submit, `initialValues` are the submitted values, unless `resetOnSuccess` is set.
   */
  readonly reset: (values?: T) => void;
  /**
   * Puts the values back to the last successful submit's, or to `initialValues` when there has
   * been none. Touched state stays. As with `setValues`, a touched field whose check it breaks shows
   * its error at once, and it clears external errors where values change.
   */
  readonly revertToLastSubmit: () => void;
  /**
   * Puts errors on fields or on the form; they show at once, and keep `valid` false while set. A
   * field's error clears when the value at its path changes, including from a change to a parent or
   * a child path. The form-level error (`form`) clears on any change to the values, and at the
   * next submit. Both clear on reset; blur, `validate` and a write of the same values leave them.
   * They don't stop a submit: it checks only the Schema, and the server checks the values again.
   */
  readonly setErrors: (errors: Errors<T>) => void;
  /**
   * Focuses the field with an error that comes first on the page, finding each by the id in
   * `field.attrs`. Fields whose element isn't on the page are skipped. `errors` keeps the Schema's
   * order, which may differ from the page's.
   */
  readonly focusFirstError: () => void;
}

/**
 * Where `submit` sends the decoded values: a write atom from `runtime.fn`, an `AtomRpc` mutation
 * or `Atom.fn`, or a getter that picks one. `payload` builds what to write from the decoded values
 * and the arguments `submit` was called with; without it, the atom gets the decoded values.
 *
 * @stability unstable
 * @since 0.4.0
 * @category models
 */
export type SubmitOptions<D, A, E, W, Args> =
  | {
      readonly atom: AtomInput<Atom.Writable<AsyncResult.AsyncResult<A, E>, W>>;
      readonly payload: (decoded: D, args: Args) => W;
    }
  | {
      readonly atom: AtomInput<Atom.Writable<AsyncResult.AsyncResult<A, E>, D>>;
      readonly payload?: undefined;
    };

/**
 * Options for an instance, shared by `useForm` and `Form.instance`.
 *
 * @stability unstable
 * @since 0.4.0
 * @category models
 */
export interface BaseInstanceOptions<T> {
  /**
   * The base of every element id, which must match between server and browser: pass `$props.id()`.
   */
  readonly id: string;
  /**
   * The values to start from, or a getter. `useForm` follows a getter: a clean form takes new
   * values, a dirty one keeps its edits.
   */
  readonly initialValues: T | (() => T);
  /**
   * Storage for the values that you own, such as an `Atom.kvs` draft that survives a reload. A
   * write to it from code counts as a change made in code, not as typing. So does a field's write
   * that the atom hands back changed (trimmed, say): the field loses its own timing for that change.
   */
  readonly values?: Atom.Writable<T> | undefined;
  /**
   * After a successful submit, reset to `initialValues` rather than adopting the submitted values
   * as the new initial values. The reset keeps `lastSubmitted` and `submitResult`.
   */
  readonly resetOnSuccess?: boolean | undefined;
}

/**
 * Options for an instance that submits to an atom.
 *
 * @stability unstable
 * @since 0.4.0
 * @category models
 */
export interface InstanceOptions<
  T,
  D,
  A,
  E,
  W,
  Args,
> extends BaseInstanceOptions<T> {
  readonly submit: SubmitOptions<D, A, E, W, Args>;
  /**
   * Claims a typed failure: return errors to put on fields or the form, or `undefined` to leave
   * the failure in `submitResult`. Defects and interruptions are never passed here. The errors
   * show at once and keep `valid` false while set. A field's error clears when the value at its
   * path changes; the form-level one (`form`) on any change to the values. All of them clear at the
   * next submit and on reset.
   */
  readonly mapError?: ((error: E) => Errors<T> | undefined) | undefined;
  /** Submit after each change that validates. Only for a submit that takes no arguments. */
  readonly autoSubmit?:
    | ([Args] extends [undefined] ? boolean : never)
    | undefined;
}

/**
 * Options for an instance with no submit atom: `submit` validates and resolves with the decoded
 * values.
 *
 * @stability unstable
 * @since 0.4.0
 * @category models
 */
export interface ValidateOnlyOptions<T> extends BaseInstanceOptions<T> {
  readonly submit?: undefined;
  readonly autoSubmit?: boolean | undefined;
}

/**
 * Creates a form instance without Svelte, for tests and code outside components. It lives in
 * `registry` (a new one by default) until `dispose` is called; a submit in flight keeps it until
 * the submit settles. A getter for `initialValues` is read once.
 *
 * **Example** (Submitting a form in a test)
 *
 * ```ts
 * import { Form } from "effect-atom-svelte";
 * import { Login } from "./forms.ts";
 *
 * const form = Form.instance(Login, {
 *   id: "test",
 *   initialValues: { email: "", password: "" },
 * });
 * form.field("email").value = "ada@example.com";
 * const exit = await form.submit();
 * form.dispose();
 * ```
 *
 * @stability unstable
 * @since 0.4.0
 * @category constructors
 */
export function instance<F extends Form<Schema.Top>, A, E, W, Args = undefined>(
  form: F,
  options: InstanceOptions<Encoded<F>, Decoded<F>, A, E, W, Args> & {
    readonly registry?: AtomRegistry.AtomRegistry | undefined;
  }
): Instance<Encoded<F>, Decoded<F>, A, E, Args> & {
  readonly dispose: () => void;
};
export function instance<F extends Form<Schema.Top>>(
  form: F,
  options: ValidateOnlyOptions<Encoded<F>> & {
    readonly registry?: AtomRegistry.AtomRegistry | undefined;
  }
): Instance<Encoded<F>, Decoded<F>, Decoded<F>, never, undefined> & {
  readonly dispose: () => void;
};
export function instance(
  form: Form<Schema.Top>,
  options: BaseInstanceOptions<unknown> & {
    readonly registry?: AtomRegistry.AtomRegistry | undefined;
    readonly submit?:
      | { readonly atom: unknown; readonly payload?: unknown }
      | undefined;
    readonly mapError?: unknown;
    readonly autoSubmit?: boolean | undefined;
  }
): unknown {
  const initial = options.initialValues;
  const getInitial = initialGetter(initial);
  return engineOf(form, {
    ...options,
    initialValues: getInitial ? getInitial() : initial,
    registry: options.registry ?? AtomRegistry.make(),
    validates: true,
  }).root;
}
