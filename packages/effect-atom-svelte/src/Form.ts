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
import { engineOf } from "./internal/form/engineOf.ts";
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
 * When a field is checked: as the user types (`"input"`), when they leave it (`"blur"`), or only
 * when the form is submitted (`"submit"`).
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
 * **Example** (Defining a sign-in form)
 *
 * ```ts
 * import { Schema } from "effect";
 * import { Form } from "effect-atom-svelte";
 *
 * export const SignIn = Form.make(
 *   Schema.Struct({
 *     email: Schema.String.check(Schema.isPattern(/^\S+@\S+$/u, { message: "Enter a valid email" })),
 *     password: Schema.String.check(Schema.isNonEmpty({ message: "Enter your password" })),
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
 * The value at path `P` in `T`. For a union, the value in each member that has the path.
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
          ? At<Rest extends readonly [] ? T[Head] : NonNullable<T[Head]>, Rest>
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
 * `isNonEmpty`, `maxlength` from `isMaxLength`, `min` and `max` from `isGreaterThanOrEqualTo`,
 * `isLessThanOrEqualTo` and `isBetween`, `pattern` from `isPattern` without flags, and `required`
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
 * timing, and clears a server or manual error on the field.
 *
 * @stability unstable
 * @since 0.4.0
 * @category models
 */
export interface Field<V> {
  value: V;
  /** The error to show: a schema error once the field's timing reveals it, or a server one. */
  readonly error: string | undefined;
  /** Whether the user has left the field. `useForm`'s `attrs.onblur` sets it. */
  touched: boolean;
  /** Whether the value differs from the initial value. */
  readonly dirty: boolean;
  /** Whether validation is running or waiting for its debounce. */
  readonly validating: boolean;
  /** The field's element id, from the instance's `id`. */
  readonly id: string;
  /** The id for the element that shows `error`, which `attrs` points `aria-describedby` at. */
  readonly errorId: string;
  /** The `name` attribute: the path joined with dots, such as `items.0.qty`. */
  readonly name: string;
  /** Where the field is now. An array item's field follows the item when it moves. */
  readonly path: AnyPath;
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
  readonly append: (item: I) => void;
  readonly remove: (index: number) => void;
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
  readonly values: T;
  readonly dirty: boolean;
  /** Whether the latest values decode, with no server or manual error left. */
  readonly valid: boolean;
  readonly validating: boolean;
  readonly submitting: boolean;
  /** The last submit's result, holding only failures `mapError` didn't claim. */
  readonly submitResult: AsyncResult.AsyncResult<A, E>;
  /** A form-level error: `mapError`'s `form`, or a Schema check with no path, once submitted. */
  readonly rootError: string | undefined;
  /** Every error on show, in the Schema's order, for an error summary. */
  readonly errors: readonly ErrorEntry[];
  readonly submitCount: number;
  readonly validationCount: number;
  /** The values of the last successful submit, encoded and decoded. */
  readonly lastSubmitted: Option.Option<{
    readonly encoded: T;
    readonly decoded: D;
  }>;
  /** Whether the values differ from the last successful submit's. */
  readonly dirtySinceSubmit: boolean;
  readonly attrs: FormAttrs;
  /**
   * Decodes the values and, when they decode, writes the submit atom and waits for its result. A
   * call while a submit runs gets that submit's result. A submit that settles after a reset doesn't
   * touch the fresh form.
   */
  readonly submit: (
    ...args: [Args] extends [undefined] ? [] : [args: Args]
  ) => Promise<Exit.Exit<A, E | ValidationError>>;
  /** Shows the errors under these paths, all by default, and resolves whether they passed. */
  readonly validate: (
    paths?: readonly (Key<T> | Path<T>)[]
  ) => Promise<boolean>;
  /** Sets several values at once. Not counted as input, so no error is revealed. */
  readonly setValues: (values: T | ((previous: T) => T)) => void;
  /** Back to the initial values, or to `values`, which become the initial values. */
  readonly reset: (values?: T) => void;
  readonly revertToLastSubmit: () => void;
  /** Puts errors on fields, or on the form. Each clears when its field changes, or on reset. */
  readonly setErrors: (errors: Errors<T>) => void;
  /** Focuses the first field with an error, by the ids in `field.attrs`. */
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
  /** Storage for the values that you own, such as an `Atom.kvs` draft that survives a reload. */
  readonly values?: Atom.Writable<T> | undefined;
  /** After a successful submit, go back to the initial values rather than adopting the submitted. */
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
   * the failure in `submitResult`. Defects and interruptions are never passed here.
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
 * import { SignIn } from "./sign-in.ts";
 *
 * const form = Form.instance(SignIn, { id: "test", initialValues: { email: "", password: "" } });
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
  return engineOf(form, {
    ...options,
    initialValues:
      typeof initial === "function" ? (initial as () => unknown)() : initial,
    registry: options.registry ?? AtomRegistry.make(),
    validates: true,
  }).root;
}
