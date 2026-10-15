// The form engine behind `Form.instance` and `useForm`: one instance's state, its validation runs
// and its submit. Internal: not exported from the package. It is untyped (values are `unknown`);
// `Form.ts` puts the Schema's types on it.
import {
  Array as Arr,
  Cause,
  Deferred,
  Effect,
  Exit,
  Option,
  Schema,
} from "effect";
import { AsyncResult, Atom } from "effect/reactivity";
import type { AtomRegistry } from "effect/reactivity";

import { awaitWrite } from "../awaitWrite.ts";
import { onDispose } from "../disposal.ts";
import { ArrayImpl } from "./array.ts";
import { constraintsAt } from "./constraints.ts";
import type { Constraints } from "./constraints.ts";
import { FieldImpl } from "./field.ts";
import { GroupImpl } from "./group.ts";
import { InstanceImpl } from "./instance.ts";
import { toPathIssues } from "./issues.ts";
import {
  equals,
  fromPathId,
  getIn,
  idSuffix,
  isLive,
  pathId,
  reconcileKeys,
  setIn,
  startsWith,
  toIndexPath,
  toKeyPath,
} from "./paths.ts";
import type { IndexPath, KeyPath, Keys } from "./paths.ts";
import type {
  Definition,
  EngineOptions,
  ErrorsInput,
  ExternalError,
  State,
  Timing,
} from "./types.ts";
import { FormValidationError } from "./validationError.ts";

const ROOT = pathId([]);
const notChecked = Symbol("notChecked");

interface RunInput {
  readonly token: number;
  readonly values: unknown;
  readonly keys: Keys;
}

type RunResult =
  | {
      readonly _tag: "Valid";
      readonly input: RunInput;
      readonly decoded: unknown;
    }
  | {
      readonly _tag: "Invalid";
      readonly input: RunInput;
      readonly issues: readonly {
        readonly path: IndexPath;
        readonly message: string;
      }[];
    };

const freshState = (initial: unknown, keys: Keys): State => ({
  checked: notChecked,
  decoded: Option.none(),
  external: new Map(),
  failure: undefined,
  initial,
  issues: new Map(),
  keys,
  lastSubmitted: Option.none(),
  revealed: new Set(),
  shown: new Set(),
  submitCount: 0,
  submitResult: AsyncResult.initial(),
  submitting: false,
  touched: new Set(),
  validating: false,
  validationCount: 0,
});

/**
 * The definition's Schema as a codec that needs no services. A runtime, when the definition has
 * one, provides those its checks need.
 */
const codecOf = (definition: Definition): Schema.Codec<unknown, unknown> =>
  // SAFETY: make checked that the Schema's decoding services are ones the definition's runtime
  // provides, and validation decodes through that runtime. Without a runtime, make allowed none.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a definition keeps its Schema as Schema.Top, without its types
  definition.schema as Schema.Codec<unknown, unknown>;

/** The values `setValues` writes: `values`, or what an update function makes of the current ones. */
const updatedValues = (values: unknown, current: unknown): unknown => {
  if (typeof values !== "function") {
    return values;
  }
  // SAFETY: setValues' type takes the values, or a function from the current values to new ones.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a typeof check can't recover the function's signature
  const update = values as (previous: unknown) => unknown;
  return update(current);
};

/** Turns a path given as `"email"` or `["items", 0]` into an index path. */
const toPath = (path: string | IndexPath): IndexPath =>
  typeof path === "string" ? [path] : path;

export class Engine {
  readonly definition: Definition;
  readonly options: EngineOptions;
  readonly registry: AtomRegistry.AtomRegistry;
  readonly stateAtom: Atom.Writable<State>;
  readonly valuesAtom: Atom.Writable<unknown>;
  readonly root: InstanceImpl;
  readonly #validateAtom: Atom.Writable<
    AsyncResult.AsyncResult<RunResult, unknown>,
    RunInput
  >;
  #original: unknown;
  // The values the latest validation run decodes.
  #runValues: unknown;
  #readState: () => State;
  #readValues: () => unknown;
  #nextKey = 0;
  #token = 0;
  #session = 0;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #scheduled = false;
  #pending: KeyPath[] = [];
  #pendingAll = false;
  // The field the latest change came from, when the user typed into it; undefined for a change
  // made in code. Its errors follow its own timing; touched fields it changes the checks of don't.
  #editing: KeyPath | undefined;
  // The values `setField` last wrote. Values arriving that aren't these were written by code,
  // through the instance or straight to an app's own `values` atom.
  #fieldWrite: unknown;
  #waiters: Deferred.Deferred<undefined>[] = [];
  #seen: { values: unknown; keys: Keys };
  #inflight: Promise<Exit.Exit<unknown, unknown>> | undefined;
  #queued = false;
  #releases: (() => void)[] = [];
  #disposed = false;
  readonly #fields = new Map<string, FieldImpl>();
  readonly #groups = new Map<string, GroupImpl>();
  readonly #arrays = new Map<string, ArrayImpl>();
  readonly #constraints = new Map<string, Constraints>();

  constructor(definition: Definition, options: EngineOptions) {
    this.definition = definition;
    this.options = options;
    this.registry = options.registry;
    const { registry } = options;
    this.#original = options.initialValues;
    // Labelled for the devtools and inspector: an instance's atoms are made here, not by the app.
    const name = definition.name ?? "form";
    this.valuesAtom =
      options.values ??
      Atom.make<unknown>(options.initialValues).pipe(
        Atom.withLabel(`${name}.values`)
      );
    const values = registry.get(this.valuesAtom);
    const keys = reconcileKeys(values, new Map(), () => this.#key());
    this.stateAtom = Atom.make<State>(
      freshState(options.initialValues, keys)
    ).pipe(Atom.withLabel(`${name}.state`));
    this.#seen = { keys, values };

    const decode = Schema.decodeUnknownEffect(codecOf(definition));
    const run = (input: RunInput): Effect.Effect<RunResult> =>
      decode(input.values, { errors: "all" }).pipe(
        Effect.map((decoded): RunResult => ({ _tag: "Valid", decoded, input })),
        Effect.catchTag("SchemaError", (failure) =>
          Effect.succeed<RunResult>({
            _tag: "Invalid",
            input,
            issues: toPathIssues(failure.issue, definition),
          })
        )
      );
    // SAFETY: the runtime provides the services the Schema's checks need; the types were checked in
    // make, which is the only place a definition gets its runtime.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a definition keeps its runtime untyped, as it keeps its Schema's services
    const runtime = definition.runtime as Atom.AtomRuntime<never> | undefined;
    this.#validateAtom = (runtime ? runtime.fn(run) : Atom.fn(run)).pipe(
      Atom.withLabel(`${name}.check`)
    );

    this.#readState = () => registry.get(this.stateAtom);
    this.#readValues = () => registry.get(this.valuesAtom);
    this.#releases.push(
      registry.mount(this.stateAtom),
      registry.subscribe(this.valuesAtom, (next) => {
        this.#onValues(next);
      })
    );
    if (options.validates) {
      this.#releases.push(
        registry.subscribe(this.#validateAtom, (result) => {
          this.#onRun(result);
        })
      );
      this.#schedule();
    }
    this.root = new InstanceImpl(this);
  }

  /** Reads state and values through these instead, as `useForm` does to make them reactive. */
  setReaders(state: () => State, values: () => unknown): void {
    this.#readState = state;
    this.#readValues = values;
  }

  get state(): State {
    return this.#readState();
  }

  get values(): unknown {
    return this.#readValues();
  }

  #key(): number {
    this.#nextKey += 1;
    return this.#nextKey;
  }

  // Reads the latest state from the registry: writes build on it, not on a reactive read that may
  // lag behind.
  #current(): State {
    return this.registry.get(this.stateAtom);
  }

  #update(f: (state: State) => State): void {
    if (!this.#disposed) {
      this.registry.set(this.stateAtom, f(this.#current()));
    }
  }

  #currentValues(): unknown {
    return this.registry.get(this.valuesAtom);
  }

  // ── values ──────────────────────────────────────────────────────────────────────────────────

  // Every change to the values passes here, whoever made it: item keys follow the arrays, errors
  // from outside the Schema clear where their field's value changed, a form-level one on any
  // change, and validation runs again.
  #onValues(next: unknown): void {
    // Compared by content: a derived `values` atom hands back a copy of what was written.
    if (!equals(next, this.#fieldWrite)) {
      this.#editing = undefined;
    }
    const previous = this.#seen;
    const state = this.#current();
    const keys = reconcileKeys(next, state.keys, () => this.#key());
    const external = new Map<string, ExternalError>();
    for (const [id, error] of state.external) {
      if (id === ROOT) {
        // A form-level error isn't tied to a field, so any edit may have answered it. Kept, it
        // would hold `valid` false until the next submit.
        if (equals(previous.values, next)) {
          external.set(id, error);
        }
        continue;
      }
      const path = fromPathId(id);
      const before = toIndexPath(previous.keys, path);
      const after = toIndexPath(keys, path);
      if (
        after !== undefined &&
        before !== undefined &&
        equals(getIn(previous.values, before), getIn(next, after))
      ) {
        external.set(id, error);
      }
    }
    const live = (ids: ReadonlySet<string>) =>
      new Set(
        [...ids].filter((id) => id === ROOT || isLive(keys, fromPathId(id)))
      );
    this.#seen = { keys, values: next };
    // Fields of items that are gone can't come back: their keys are never reused.
    for (const cache of [this.#fields, this.#groups, this.#arrays]) {
      for (const id of cache.keys()) {
        if (!isLive(keys, fromPathId(id))) {
          cache.delete(id);
        }
      }
    }
    this.#update((current) => ({
      ...current,
      external,
      keys,
      revealed: live(current.revealed),
      shown: live(current.shown),
      touched: live(current.touched),
    }));
    this.#schedule();
  }

  /** Writes a field's value, as typing into it does. */
  setField(path: KeyPath, value: unknown): void {
    const index = toIndexPath(this.#current().keys, path);
    if (index === undefined) {
      return;
    }
    this.#editing = path;
    this.#fieldWrite = setIn(this.#currentValues(), index, value);
    this.registry.set(this.valuesAtom, this.#fieldWrite);
    this.#trigger(path, "input");
  }

  /** Marks a field touched, as leaving it does, and checks it if `validateOn` says so. */
  leave(path: KeyPath): void {
    this.setTouched(path, true);
    this.#trigger(path, "blur");
  }

  setTouched(path: KeyPath, touched: boolean): void {
    const id = pathId(path);
    this.#update((state) => {
      if (state.touched.has(id) === touched) {
        return state;
      }
      const next = new Set(state.touched);
      if (touched) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return { ...state, touched: next };
    });
  }

  setValues(values: unknown): void {
    this.#editing = undefined;
    this.registry.set(
      this.valuesAtom,
      updatedValues(values, this.#currentValues())
    );
  }

  /** Changes an array and its item keys together, so state stays with each item. */
  updateArray(
    path: KeyPath,
    f: (items: unknown[], keys: number[]) => void
  ): void {
    this.#editing = undefined;
    const state = this.#current();
    const index = toIndexPath(state.keys, path);
    if (index === undefined) {
      return;
    }
    const current = getIn(this.#currentValues(), index);
    const items = Arr.isArray(current) ? [...current] : [];
    const keys = [...(state.keys.get(pathId(path)) ?? [])];
    f(items, keys);
    const nextKeys = new Map([...state.keys, [pathId(path), keys]]);
    this.#update((latest) => ({ ...latest, keys: nextKeys }));
    this.registry.set(
      this.valuesAtom,
      setIn(this.#currentValues(), index, items)
    );
  }

  newKey(): number {
    return this.#key();
  }

  /** The current initial values change: a clean form takes them, a dirty one keeps its edits. */
  setInitial(initial: unknown): void {
    this.#editing = undefined;
    const state = this.#current();
    if (equals(initial, state.initial)) {
      return;
    }
    const clean = equals(this.#currentValues(), state.initial);
    this.#original = initial;
    this.#update((latest) => ({ ...latest, initial }));
    if (clean) {
      this.registry.set(this.valuesAtom, initial);
    }
  }

  reset(values?: unknown): void {
    if (values !== undefined) {
      this.#original = values;
    }
    this.#restart(values === undefined ? this.#current().initial : values, {
      keepSubmit: false,
    });
  }

  #restart(initial: unknown, options: { readonly keepSubmit: boolean }): void {
    this.#session += 1;
    this.#editing = undefined;
    this.#pending = [];
    this.#pendingAll = false;
    this.#inflight = undefined;
    this.#queued = false;
    const state = this.#current();
    const keys = reconcileKeys(initial, new Map(), () => this.#key());
    const fresh = freshState(initial, keys);
    this.#update(() =>
      options.keepSubmit
        ? {
            ...fresh,
            lastSubmitted: state.lastSubmitted,
            submitResult: state.submitResult,
          }
        : fresh
    );
    this.#seen = { keys, values: this.#currentValues() };
    this.registry.set(this.valuesAtom, initial);
    this.#schedule();
  }

  revertToLastSubmit(): void {
    this.#editing = undefined;
    const state = this.#current();
    this.registry.set(
      this.valuesAtom,
      Option.match(state.lastSubmitted, {
        onNone: () => state.initial,
        onSome: ({ encoded }) => encoded,
      })
    );
  }

  setErrors(errors: ErrorsInput, source: "submit" | "manual"): void {
    const state = this.#current();
    const external = new Map(state.external);
    const put = (path: IndexPath, message: string | undefined) => {
      const keyPath = toKeyPath(state.keys, path);
      if (keyPath !== undefined && message !== undefined) {
        external.set(pathId(keyPath), { message, source });
      }
    };
    for (const [name, message] of Object.entries(errors.fields ?? {})) {
      put([name], message);
    }
    for (const [path, message] of errors.paths ?? []) {
      put(toPath(path), message);
    }
    if (errors.form !== undefined) {
      external.set(ROOT, { message: errors.form, source });
    }
    this.#update((latest) => ({ ...latest, external }));
  }

  // ── validation ──────────────────────────────────────────────────────────────────────────────

  #schedule(): void {
    if (!this.options.validates || this.#disposed) {
      return;
    }
    if (!this.#current().validating) {
      this.#update((state) => ({ ...state, validating: true }));
    }
    clearTimeout(this.#timer);
    if (this.definition.debounce > 0) {
      // oxlint-disable-next-line effecttsgo/global-timers -- debounces validation between the user's edits, outside any Effect program
      this.#timer = setTimeout(() => {
        this.#run();
      }, this.definition.debounce);
      return;
    }
    // Several changes in one tick, such as a reset, run once.
    if (!this.#scheduled) {
      this.#scheduled = true;
      queueMicrotask(() => {
        this.#scheduled = false;
        this.#run();
      });
    }
  }

  // Runs now rather than after the debounce, as submit and validate need the result.
  #flush(): void {
    if (this.#timer !== undefined) {
      clearTimeout(this.#timer);
      this.#timer = undefined;
      this.#run();
    }
  }

  #run(): void {
    this.#timer = undefined;
    if (this.#disposed) {
      return;
    }
    this.#token += 1;
    this.#runValues = this.#currentValues();
    this.registry.set(this.#validateAtom, {
      keys: this.#current().keys,
      token: this.#token,
      values: this.#runValues,
    });
  }

  #onRun(result: AsyncResult.AsyncResult<RunResult, unknown>): void {
    if (result.waiting || result._tag === "Initial") {
      return;
    }
    if (result._tag === "Failure") {
      // The decode itself failed, not the values: a runtime whose layer failed, or a defect. Every
      // field is unchecked, so the form isn't valid.
      console.error(
        "effect-atom-svelte: a form's validation failed",
        Cause.pretty(result.cause)
      );
      const values = this.#runValues;
      this.#update((state) => ({
        ...state,
        checked: values,
        decoded: Option.none(),
        failure: result.cause,
        validating: false,
      }));
      this.#release();
      return;
    }
    const run = result.value;
    if (run.input.token !== this.#token) {
      return;
    }
    const issues = new Map<string, string>();
    const list = run._tag === "Invalid" ? run.issues : [];
    for (const issue of list) {
      // The run's own keys: items may have moved since it started.
      let keyPath = toKeyPath(run.input.keys, issue.path);
      // An index with no item, as from a tuple, lands on the nearest path that has one.
      for (
        let length = issue.path.length - 1;
        keyPath === undefined && length >= 0;
        length -= 1
      ) {
        keyPath = toKeyPath(run.input.keys, issue.path.slice(0, length));
      }
      const id = pathId(keyPath ?? []);
      if (!issues.has(id)) {
        issues.set(id, issue.message);
      }
    }
    const fresh =
      run.input.values === this.#currentValues() && this.#timer === undefined;
    this.#update((state) => ({
      ...state,
      checked: run.input.values,
      decoded: run._tag === "Valid" ? Option.some(run.decoded) : Option.none(),
      failure: undefined,
      issues,
      validating: !fresh,
    }));
    // Once the form has been submitted, every error shows: with input timing, as soon as it appears,
    // such as on a field a union's tag just brought in.
    if (
      fresh &&
      this.#current().submitCount > 0 &&
      this.definition.revalidateOn === "input"
    ) {
      this.#pendingAll = true;
    }
    this.#reveal(fresh);
    if (fresh) {
      this.#release();
      this.#autoSubmit();
    }
  }

  // Shows the current run's errors on the paths asked for, and on paths already showing one. A
  // path whose check now passes stops showing, whatever the timing ("reward early"). The paths
  // asked for are used up only by a run of the current values.
  #reveal(consume: boolean): void {
    const pending = this.#pending;
    const all = this.#pendingAll;
    const editing = this.#editing;
    if (consume) {
      this.#pending = [];
      this.#pendingAll = false;
    }
    this.#update((state) => {
      const revealed = new Set<string>();
      for (const id of state.issues.keys()) {
        const path = fromPathId(id);
        // An error on a field the user has left, which a change elsewhere brought on (a
        // "passwords do not match" after editing the password), shows at once: the field is
        // touched. The field being edited keeps to its own timing, and so does a field whose
        // timing is "submit": its errors wait for a submit or validate().
        const fromElsewhere =
          state.touched.has(id) &&
          this.#phase(state, id) !== "submit" &&
          (editing === undefined || !startsWith(path, editing));
        const asked =
          all ||
          fromElsewhere ||
          pending.some((prefix) => startsWith(path, prefix));
        if (state.revealed.has(id) || (consume && asked)) {
          revealed.add(id);
        }
      }
      return {
        ...state,
        revealed,
        shown: new Set([...state.shown, ...revealed]),
      };
    });
  }

  // A field's timing: `validateOn` until the field has shown an error or the form was submitted,
  // then `revalidateOn`.
  #phase(state: State, id: string): Timing {
    return state.shown.has(id) || state.submitCount > 0
      ? this.definition.revalidateOn
      : this.definition.validateOn;
  }

  // A field event asks for its errors to show when the field's timing matches it.
  #trigger(path: KeyPath, event: Timing): void {
    if (this.#phase(this.#current(), pathId(path)) !== event) {
      return;
    }
    this.#pending.push(path);
    if (this.#isCurrent()) {
      this.#reveal(true);
    }
  }

  #isCurrent(): boolean {
    const state = this.#current();
    return state.checked === this.#currentValues() && !state.validating;
  }

  // A run that couldn't decode at all (a check that threw, a runtime that failed) may have been a
  // blip, so validate and submit run it again rather than reuse its failure.
  #retryFailed(): void {
    if (
      this.options.validates &&
      !this.#disposed &&
      this.#current().failure !== undefined
    ) {
      this.#update((state) => ({ ...state, validating: true }));
      clearTimeout(this.#timer);
      this.#run();
    }
  }

  // Resolves once a run of the current values has settled.
  #settled(): Promise<undefined> {
    if (!this.options.validates || this.#disposed || this.#isCurrent()) {
      return Promise.resolve(undefined);
    }
    // Waiting first: a run with nothing async settles inside #flush, and releases its waiters.
    const waiter = Deferred.makeUnsafe<undefined>();
    this.#waiters.push(waiter);
    this.#flush();
    return Effect.runPromise(Deferred.await(waiter));
  }

  #release(): void {
    const waiters = this.#waiters;
    this.#waiters = [];
    for (const waiter of waiters) {
      Deferred.doneUnsafe(waiter, Effect.undefined);
    }
  }

  /**
   * Checks the given paths (all by default), shows their errors, and says whether they passed: no
   * Schema error and no external error at or under any of them.
   */
  // oxlint-disable-next-line effecttsgo/async-function -- the form's validate, part of the library's Promise-facing API for Svelte handlers
  async validate(paths?: readonly (string | IndexPath)[]): Promise<boolean> {
    const state = this.#current();
    const keyPaths =
      paths === undefined
        ? undefined
        : paths.flatMap((path) => {
            const keyPath = toKeyPath(state.keys, toPath(path));
            return keyPath === undefined ? [] : [keyPath];
          });
    if (keyPaths === undefined) {
      this.#pendingAll = true;
    } else {
      this.#pending.push(...keyPaths);
    }
    this.#update((latest) => ({
      ...latest,
      validationCount: latest.validationCount + 1,
    }));
    this.#retryFailed();
    await this.#settled();
    if (this.#isCurrent()) {
      this.#reveal(true);
    }
    const latest = this.#current();
    if (latest.failure !== undefined) {
      return false;
    }
    // A server or setErrors error counts as a Schema one does; it already shows, as it always does.
    return [...latest.issues.keys(), ...latest.external.keys()].every((id) => {
      if (keyPaths === undefined) {
        return false;
      }
      const path = fromPathId(id);
      return !keyPaths.some((prefix) => startsWith(path, prefix));
    });
  }

  // ── submit ──────────────────────────────────────────────────────────────────────────────────

  submit(args?: unknown): Promise<Exit.Exit<unknown, unknown>> {
    // One submit at a time per instance: a second call while one runs gets the same result.
    if (this.#inflight !== undefined) {
      return this.#inflight;
    }
    const inflight = this.#submitOnce(args);
    this.#inflight = inflight;
    return inflight;
  }

  // oxlint-disable-next-line effecttsgo/async-function -- behind the form's submit, part of the library's Promise-facing API for Svelte handlers
  async #submitOnce(args: unknown): Promise<Exit.Exit<unknown, unknown>> {
    const session = this.#session;
    try {
      return await this.#submit(args);
    } finally {
      // A reset has already let go of this submit.
      if (session === this.#session) {
        this.#inflight = undefined;
        if (this.#queued) {
          this.#queued = false;
          if (!this.#disposeAfterSubmit) {
            this.#autoSubmit();
          }
        }
      }
      if (this.#disposeAfterSubmit) {
        this.#disposeAfterSubmit = false;
        this.dispose();
      }
    }
  }

  // oxlint-disable-next-line effecttsgo/async-function -- behind the form's submit, part of the library's Promise-facing API for Svelte handlers
  async #submit(args: unknown): Promise<Exit.Exit<unknown, unknown>> {
    const session = this.#session;
    this.#pendingAll = true;
    this.#update((state) => ({
      ...state,
      // Errors from the last submit, and a form-level error from setErrors, give way to this one.
      external: new Map(
        [...state.external].filter(
          ([id, error]) => error.source !== "submit" && id !== ROOT
        )
      ),
      submitCount: state.submitCount + 1,
    }));
    this.#retryFailed();
    await this.#settled();
    if (session !== this.#session) {
      return Exit.interrupt();
    }
    if (this.options.validates) {
      this.#reveal(true);
    }
    const state = this.#current();
    // The values the run decoded: a write since the submit started isn't part of it.
    const encoded = this.options.validates
      ? state.checked
      : this.#currentValues();
    let decoded: unknown;
    if (this.options.validates) {
      // The decode couldn't run at all: there is nothing to send.
      if (state.failure !== undefined) {
        // Not the user's input, and nothing claims it: a defect, as the error a runtime failed with
        // isn't in the submit's error type. The app shows it, as for any defect.
        const cause = Cause.die(Cause.squash(state.failure));
        this.#update((latest) => ({
          ...latest,
          submitResult: AsyncResult.failure(cause),
        }));
        return Exit.failCause(cause);
      }
      if (state.issues.size > 0 || Option.isNone(state.decoded)) {
        return Exit.fail(new FormValidationError({ errors: this.root.errors }));
      }
      decoded = state.decoded.value;
    } else {
      // Not validating (on the server): decode now.
      const exit = await Effect.runPromiseExit(
        Schema.decodeUnknownEffect(codecOf(this.definition))(encoded, {
          errors: "all",
        })
      );
      if (Exit.isFailure(exit)) {
        return Exit.fail(new FormValidationError({ errors: [] }));
      }
      decoded = exit.value;
    }

    const target = this.options.submit;
    if (target === undefined) {
      this.#succeeded(session, encoded, decoded, decoded);
      return Exit.succeed(decoded);
    }
    const atom = target.atom();
    const value = target.payload ? target.payload(decoded, args) : decoded;
    this.#update((latest) => ({
      ...latest,
      submitResult: AsyncResult.waiting(latest.submitResult),
      submitting: true,
    }));
    // oxlint-disable-next-line effecttsgo/global-date -- compared with an AsyncResult's timestamp, which Effect takes from Date.now
    const start = Date.now();
    this.registry.set(atom, value);
    // The wait holds the atom, so the call finishes after the component is gone, unless the
    // registry itself is disposed of, which ends it as interrupted.
    const controller = new AbortController();
    const cancel = onDispose(this.registry, () => {
      controller.abort();
    });
    let exit: Exit.Exit<unknown, unknown>;
    try {
      exit = await awaitWrite(this.registry, atom, start, controller.signal);
    } finally {
      cancel();
    }
    if (session !== this.#session) {
      return exit;
    }
    if (Exit.isSuccess(exit)) {
      this.#succeeded(session, encoded, decoded, exit.value);
      return exit;
    }
    const error = Cause.findErrorOption(exit.cause);
    const claimed =
      Option.isSome(error) && this.options.mapError
        ? this.options.mapError(error.value)
        : undefined;
    if (claimed !== undefined) {
      this.setErrors(claimed, "submit");
    }
    this.#update((latest) => ({
      ...latest,
      submitResult:
        claimed === undefined
          ? AsyncResult.failure(exit.cause)
          : AsyncResult.initial(),
      submitting: false,
    }));
    if (claimed !== undefined) {
      // Server errors show at once, as after a failed check.
      this.#update((latest) => ({
        ...latest,
        shown: new Set([...latest.shown, ...latest.external.keys()]),
      }));
    }
    return exit;
  }

  #succeeded(
    session: number,
    encoded: unknown,
    decoded: unknown,
    value: unknown
  ): void {
    if (session !== this.#session) {
      return;
    }
    const lastSubmitted = Option.some({ decoded, encoded });
    this.#update((latest) => ({
      ...latest,
      initial: this.options.resetOnSuccess === true ? latest.initial : encoded,
      lastSubmitted,
      submitResult: AsyncResult.success(value),
      submitting: false,
    }));
    if (this.options.resetOnSuccess === true) {
      this.#restart(this.#original, { keepSubmit: true });
    }
  }

  #autoSubmit(): void {
    if (this.options.autoSubmit !== true || this.#disposed) {
      return;
    }
    if (this.#inflight !== undefined) {
      this.#queued = true;
      return;
    }
    const state = this.#current();
    const baseline = Option.match(state.lastSubmitted, {
      onNone: () => state.initial,
      onSome: ({ encoded }) => encoded,
    });
    const values = this.#currentValues();
    // Only edits: not the values a reset (as after resetOnSuccess) brought back.
    if (
      state.issues.size === 0 &&
      this.#isCurrent() &&
      !equals(values, baseline) &&
      !equals(values, state.initial)
    ) {
      void this.submit();
    }
  }

  // ── lookups for fields ─────────────────────────────────────────────────────────────────────

  /** The error to show on a path: from outside the Schema first, then the Schema's once revealed. */
  errorAt(path: KeyPath): string | undefined {
    const { state } = this;
    const id = pathId(path);
    const external = state.external.get(id);
    if (external !== undefined) {
      return external.message;
    }
    return state.revealed.has(id) ? state.issues.get(id) : undefined;
  }

  indexPath(path: KeyPath): IndexPath | undefined {
    return toIndexPath(this.state.keys, path);
  }

  /** Resolves `relative`, an index path below `base`, to a key path. */
  resolve(base: KeyPath, relative: string | IndexPath): KeyPath {
    const { keys } = this.state;
    const out = [...base];
    for (const segment of toPath(relative)) {
      if (typeof segment === "number") {
        const key = keys.get(pathId(out))?.[segment];
        if (key === undefined) {
          throw new RangeError(
            `effect-atom-svelte: the form has no item at index ${segment} of ${JSON.stringify(
              this.indexPath(out) ?? out
            )}`
          );
        }
        out.push(key);
      } else {
        out.push(segment);
      }
    }
    return out;
  }

  elementId(path: KeyPath): string {
    return path.length === 0
      ? this.options.id
      : `${this.options.id}-${idSuffix(path)}`;
  }

  constraints(path: IndexPath): Constraints {
    const schemaPath = path.map((segment) =>
      typeof segment === "number" ? 0 : segment
    );
    const id = pathId(schemaPath);
    let found = this.#constraints.get(id);
    if (found === undefined) {
      found = constraintsAt(this.definition.schema.ast, schemaPath);
      this.#constraints.set(id, found);
    }
    return found;
  }

  field(path: KeyPath): FieldImpl {
    const id = pathId(path);
    let field = this.#fields.get(id);
    if (field === undefined) {
      field = new FieldImpl(this, path);
      this.#fields.set(id, field);
    }
    return field;
  }

  group(path: KeyPath): GroupImpl {
    const id = pathId(path);
    let group = this.#groups.get(id);
    if (group === undefined) {
      group = new GroupImpl(this, path);
      this.#groups.set(id, group);
    }
    return group;
  }

  array(path: KeyPath): ArrayImpl {
    const id = pathId(path);
    let array = this.#arrays.get(id);
    if (array === undefined) {
      array = new ArrayImpl(this, path);
      this.#arrays.set(id, array);
    }
    return array;
  }

  // ── lifetime ────────────────────────────────────────────────────────────────────────────────

  #disposeAfterSubmit = false;

  /** Releases the instance's atoms; a submit in flight keeps them until it settles. */
  dispose(): void {
    if (this.#disposed) {
      return;
    }
    if (this.#inflight !== undefined) {
      this.#disposeAfterSubmit = true;
      return;
    }
    this.#disposed = true;
    clearTimeout(this.#timer);
    this.#release();
    for (const release of this.#releases) {
      release();
    }
    this.#releases = [];
  }
}
