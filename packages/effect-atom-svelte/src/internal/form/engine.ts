// The form engine behind `Form.instance` and `useForm`: one instance's state, its validation runs
// and its submit. Internal: not exported from the package. It is untyped (values are `unknown`);
// `Form.ts` puts the Schema's types on it.
import { Cause, Data, Effect, Exit, Option, Schema } from "effect";
import { AsyncResult, Atom } from "effect/reactivity";
import type { AtomRegistry } from "effect/reactivity";

import { awaitWrite } from "../awaitWrite.ts";
import { onDispose } from "../disposal.ts";
import { constraintsAt } from "./constraints.ts";
import type { Constraints } from "./constraints.ts";
import { toPathIssues } from "./issues.ts";
import type { CheckHook, LeafHook } from "./issues.ts";
import {
  equals,
  getIn,
  idSuffix,
  isLive,
  nameOf,
  pathId,
  reconcileKeys,
  setIn,
  startsWith,
  toIndexPath,
  toKeyPath,
} from "./paths.ts";
import type { IndexPath, KeyPath, Keys } from "./paths.ts";

/** When a field is checked: as the user types, when they leave it, or only on submit. */
export type Timing = "submit" | "blur" | "input";

/** Where an error came from, which decides when it clears. */
export type ErrorSource = "schema" | "submit" | "manual";

/** Errors to put on a form: per top-level field, per path, and form-level. */
export interface ErrorsInput {
  readonly fields?: Readonly<Record<string, string | undefined>> | undefined;
  readonly paths?:
    | ReadonlyArray<readonly [IndexPath | string, string]>
    | undefined;
  readonly form?: string | undefined;
}

/** A form's validation failure, as `submit` reports it. */
export class FormValidationError extends Data.TaggedError(
  "FormValidationError"
)<{
  readonly errors: ReadonlyArray<{
    readonly path: IndexPath;
    readonly message: string;
  }>;
}> {}

/** A definition's settings, shared by every instance. */
export interface Definition {
  readonly schema: Schema.Top;
  readonly runtime?: Atom.AtomRuntime<any, any> | undefined;
  readonly validateOn: Timing;
  readonly revalidateOn: Timing;
  readonly debounce: number;
  readonly leafHook?: LeafHook | undefined;
  readonly checkHook?: CheckHook | undefined;
}

/** One instance's settings. */
export interface EngineOptions {
  readonly registry: AtomRegistry.AtomRegistry;
  readonly id: string;
  readonly initialValues: unknown;
  readonly values?: Atom.Writable<any, any> | undefined;
  readonly submit?:
    | {
        readonly atom: () => Atom.Writable<
          AsyncResult.AsyncResult<unknown, unknown>,
          unknown
        >;
        readonly payload?:
          | ((decoded: unknown, args: unknown) => unknown)
          | undefined;
      }
    | undefined;
  readonly mapError?: ((error: unknown) => ErrorsInput | undefined) | undefined;
  readonly autoSubmit?: boolean | undefined;
  readonly resetOnSuccess?: boolean | undefined;
  /** Whether validation runs at all: not while rendering on the server. */
  readonly validates: boolean;
}

interface ExternalError {
  readonly message: string;
  readonly source: "submit" | "manual";
}

/** An instance's state, in one atom. Error maps are keyed by `pathId` of a key path. */
export interface State {
  readonly initial: unknown;
  readonly keys: Keys;
  readonly touched: ReadonlySet<string>;
  /** Schema errors on show, by path. A path drops out once its check passes. */
  readonly revealed: ReadonlySet<string>;
  /** Paths that have shown an error since the last reset: they follow `revalidateOn`. */
  readonly shown: ReadonlySet<string>;
  /** The latest validation run's messages, in the Schema's order. */
  readonly issues: ReadonlyMap<string, string>;
  /** The values that run decoded, to tell whether its result is current. */
  readonly checked: unknown;
  readonly decoded: Option.Option<unknown>;
  readonly validating: boolean;
  readonly external: ReadonlyMap<string, ExternalError>;
  readonly submitCount: number;
  readonly validationCount: number;
  readonly submitting: boolean;
  readonly submitResult: AsyncResult.AsyncResult<unknown, unknown>;
  readonly lastSubmitted: Option.Option<{
    readonly encoded: unknown;
    readonly decoded: unknown;
  }>;
}

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
      readonly issues: ReadonlyArray<{
        readonly path: IndexPath;
        readonly message: string;
      }>;
    };

const freshState = (initial: unknown, keys: Keys): State => ({
  checked: notChecked,
  decoded: Option.none(),
  external: new Map(),
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
  readonly #original: unknown;
  #readState: () => State;
  #readValues: () => unknown;
  #nextKey = 0;
  #token = 0;
  #session = 0;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #scheduled = false;
  #pending: KeyPath[] = [];
  #pendingAll = false;
  #waiters: (() => void)[] = [];
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
    this.valuesAtom = (options.values ??
      Atom.make<unknown>(options.initialValues)) as Atom.Writable<unknown>;
    const values = registry.get(this.valuesAtom);
    const keys = reconcileKeys(values, new Map(), () => this.#key());
    this.stateAtom = Atom.make<State>(freshState(options.initialValues, keys));
    this.#seen = { keys, values };

    const decode = Schema.decodeUnknownEffect(
      definition.schema as Schema.Codec<unknown, unknown>
    );
    const run = (input: RunInput): Effect.Effect<RunResult> =>
      decode(input.values, { errors: "all" }).pipe(
        Effect.map((decoded): RunResult => ({ _tag: "Valid", decoded, input })),
        Effect.catchTag("SchemaError", (error) =>
          Effect.succeed<RunResult>({
            _tag: "Invalid",
            input,
            issues: toPathIssues(error.issue, definition),
          })
        )
      );
    this.#validateAtom = (definition.runtime
      ? definition.runtime.fn(run)
      : Atom.fn(run)) as unknown as Atom.Writable<
      AsyncResult.AsyncResult<RunResult, unknown>,
      RunInput
    >;

    this.#readState = () => registry.get(this.stateAtom);
    this.#readValues = () => registry.get(this.valuesAtom);
    this.#releases.push(
      registry.mount(this.stateAtom),
      registry.subscribe(this.valuesAtom, (next) => this.#onValues(next))
    );
    if (options.validates) {
      this.#releases.push(
        registry.subscribe(this.#validateAtom, (result) => this.#onRun(result))
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
  // from outside the Schema clear where their field's value changed, and validation runs again.
  #onValues(next: unknown): void {
    const previous = this.#seen;
    const state = this.#current();
    const keys = reconcileKeys(next, state.keys, () => this.#key());
    const external = new Map<string, ExternalError>();
    for (const [id, error] of state.external) {
      if (id === ROOT) {
        external.set(id, error);
        continue;
      }
      const path = JSON.parse(id) as KeyPath;
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
        [...ids].filter(
          (id) => id === ROOT || isLive(keys, JSON.parse(id) as KeyPath)
        )
      );
    this.#seen = { keys, values: next };
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
    this.registry.set(
      this.valuesAtom,
      setIn(this.#currentValues(), index, value)
    );
    this.#trigger(path, "input");
  }

  /** Marks a field touched, as leaving it does, and checks it if `validateOn` says so. */
  blur(path: KeyPath): void {
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
    this.registry.set(
      this.valuesAtom,
      typeof values === "function"
        ? (values as (previous: unknown) => unknown)(this.#currentValues())
        : values
    );
  }

  /** Changes an array and its item keys together, so state stays with each item. */
  updateArray(
    path: KeyPath,
    f: (items: unknown[], keys: number[]) => void
  ): void {
    const state = this.#current();
    const index = toIndexPath(state.keys, path);
    if (index === undefined) {
      return;
    }
    const current = getIn(this.#currentValues(), index);
    const items = Array.isArray(current) ? [...current] : [];
    const keys = [...(state.keys.get(pathId(path)) ?? [])];
    f(items, keys);
    const nextKeys = new Map(state.keys);
    nextKeys.set(pathId(path), keys);
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
    const state = this.#current();
    if (equals(initial, state.initial)) {
      return;
    }
    const clean = equals(this.#currentValues(), state.initial);
    this.#update((latest) => ({ ...latest, initial }));
    if (clean) {
      this.registry.set(this.valuesAtom, initial);
    }
  }

  reset(values?: unknown): void {
    this.#restart(values === undefined ? this.#current().initial : values, {
      keepSubmit: false,
    });
  }

  #restart(initial: unknown, options: { readonly keepSubmit: boolean }): void {
    this.#session += 1;
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
      this.#timer = setTimeout(() => this.#run(), this.definition.debounce);
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
    this.registry.set(this.#validateAtom, {
      keys: this.#current().keys,
      token: this.#token,
      values: this.#currentValues(),
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
      this.#update((state) => ({ ...state, validating: false }));
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
    if (consume) {
      this.#pending = [];
      this.#pendingAll = false;
    }
    this.#update((state) => {
      const revealed = new Set<string>();
      for (const id of state.issues.keys()) {
        const path = JSON.parse(id) as KeyPath;
        if (
          state.revealed.has(id) ||
          (consume &&
            (all || pending.some((prefix) => startsWith(path, prefix))))
        ) {
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

  // A field event asks for its errors to show when the field's timing matches it: `validateOn`
  // until the field has shown an error or the form was submitted, then `revalidateOn`.
  #trigger(path: KeyPath, event: Timing): void {
    const state = this.#current();
    const phase =
      state.shown.has(pathId(path)) || state.submitCount > 0
        ? this.definition.revalidateOn
        : this.definition.validateOn;
    if (phase !== event) {
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

  // Resolves once a run of the current values has settled.
  #settled(): Promise<void> {
    if (!this.options.validates || this.#isCurrent()) {
      return Promise.resolve();
    }
    this.#flush();
    return new Promise((resolve) => {
      this.#waiters.push(resolve);
    });
  }

  #release(): void {
    const waiters = this.#waiters;
    this.#waiters = [];
    for (const resolve of waiters) {
      resolve();
    }
  }

  /** Checks the given paths (all by default), shows their errors, and says whether they passed. */
  async validate(paths?: ReadonlyArray<string | IndexPath>): Promise<boolean> {
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
    await this.#settled();
    if (this.#isCurrent()) {
      this.#reveal(true);
    }
    const latest = this.#current();
    return [...latest.issues.keys()].every((id) => {
      if (keyPaths === undefined) {
        return false;
      }
      const path = JSON.parse(id) as KeyPath;
      return !keyPaths.some((prefix) => startsWith(path, prefix));
    });
  }

  // ── submit ──────────────────────────────────────────────────────────────────────────────────

  submit(args?: unknown): Promise<Exit.Exit<unknown, unknown>> {
    // One submit at a time per instance: a second call while one runs gets the same result.
    if (this.#inflight !== undefined) {
      return this.#inflight;
    }
    const inflight = this.#submit(args).finally(() => {
      if (this.#inflight === inflight) {
        this.#inflight = undefined;
        if (this.#queued) {
          this.#queued = false;
          this.#autoSubmit();
        }
        if (this.#disposeAfterSubmit) {
          this.dispose();
        }
      }
    });
    this.#inflight = inflight;
    return inflight;
  }

  async #submit(args: unknown): Promise<Exit.Exit<unknown, unknown>> {
    const session = this.#session;
    this.#pendingAll = true;
    this.#update((state) => ({
      ...state,
      external: new Map(
        [...state.external].filter(([, error]) => error.source !== "submit")
      ),
      submitCount: state.submitCount + 1,
    }));
    await this.#settled();
    if (session !== this.#session) {
      return Exit.interrupt();
    }
    if (this.options.validates) {
      this.#reveal(true);
    }
    const state = this.#current();
    const encoded = this.#currentValues();
    let decoded: unknown;
    if (this.options.validates) {
      if (state.issues.size > 0 || Option.isNone(state.decoded)) {
        return Exit.fail(new FormValidationError({ errors: this.root.errors }));
      }
      decoded = state.decoded.value;
    } else {
      // Not validating (on the server): decode now.
      const exit = await Effect.runPromiseExit(
        Schema.decodeUnknownEffect(
          this.definition.schema as Schema.Codec<unknown, unknown>
        )(encoded, { errors: "all" }) as Effect.Effect<
          unknown,
          Schema.SchemaError
        >
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
    const start = Date.now();
    this.registry.set(atom, value);
    // The wait holds the atom, so the call finishes after the component is gone, unless the
    // registry itself is disposed of, which ends it as interrupted.
    const controller = new AbortController();
    const cancel = onDispose(this.registry, () => controller.abort());
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
          ? AsyncResult.failure(exit.cause as Cause.Cause<unknown>)
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
      initial: this.options.resetOnSuccess ? latest.initial : encoded,
      lastSubmitted,
      submitResult: AsyncResult.success(value),
      submitting: false,
    }));
    if (this.options.resetOnSuccess) {
      this.#restart(this.#original, { keepSubmit: true });
    }
  }

  #autoSubmit(): void {
    if (!this.options.autoSubmit || this.#disposed) {
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
    if (
      state.issues.size === 0 &&
      this.#isCurrent() &&
      !equals(this.#currentValues(), baseline)
    ) {
      void this.submit();
    }
  }

  // ── lookups for fields ─────────────────────────────────────────────────────────────────────

  /** The error to show on a path: from outside the Schema first, then the Schema's once revealed. */
  errorAt(path: KeyPath): string | undefined {
    const state = this.state;
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
    const keys = this.state.keys;
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

export class GroupImpl {
  readonly engine: Engine;
  readonly keyPath: KeyPath;

  constructor(engine: Engine, keyPath: KeyPath) {
    this.engine = engine;
    this.keyPath = keyPath;
  }

  get path(): IndexPath {
    return this.engine.indexPath(this.keyPath) ?? [];
  }

  field(path: string | IndexPath): FieldImpl {
    return this.engine.field(this.engine.resolve(this.keyPath, path));
  }

  array(path: string | IndexPath): ArrayImpl {
    return this.engine.array(this.engine.resolve(this.keyPath, path));
  }

  at(path: string | IndexPath): GroupImpl {
    return this.engine.group(this.engine.resolve(this.keyPath, path));
  }
}

export class FieldImpl {
  readonly #engine: Engine;
  readonly keyPath: KeyPath;
  readonly #blur = () => this.#engine.blur(this.keyPath);

  constructor(engine: Engine, keyPath: KeyPath) {
    this.#engine = engine;
    this.keyPath = keyPath;
  }

  get path(): IndexPath {
    return this.#engine.indexPath(this.keyPath) ?? [];
  }

  get value(): unknown {
    const index = this.#engine.indexPath(this.keyPath);
    return index === undefined ? undefined : getIn(this.#engine.values, index);
  }

  set value(value: unknown) {
    this.#engine.setField(this.keyPath, value);
  }

  get error(): string | undefined {
    return this.#engine.errorAt(this.keyPath);
  }

  get touched(): boolean {
    return this.#engine.state.touched.has(pathId(this.keyPath));
  }

  set touched(touched: boolean) {
    this.#engine.setTouched(this.keyPath, touched);
  }

  get dirty(): boolean {
    const index = this.#engine.indexPath(this.keyPath);
    return (
      index !== undefined &&
      !equals(
        getIn(this.#engine.values, index),
        getIn(this.#engine.state.initial, index)
      )
    );
  }

  get validating(): boolean {
    return this.#engine.state.validating;
  }

  get id(): string {
    return this.#engine.elementId(this.keyPath);
  }

  get errorId(): string {
    return `${this.id}-error`;
  }

  get name(): string {
    return nameOf(this.path);
  }

  get attrs() {
    const invalid = this.error !== undefined;
    return {
      "aria-describedby": invalid ? this.errorId : undefined,
      "aria-invalid": invalid ? true : undefined,
      id: this.id,
      name: this.name,
      onblur: this.#blur,
    } as const;
  }

  get constraints(): Constraints {
    return this.#engine.constraints(this.path);
  }

  /** What leaving the field does, for a custom control with no blur event of its own. */
  blur(): void {
    this.#blur();
  }
}

export class ArrayImpl {
  readonly #engine: Engine;
  readonly keyPath: KeyPath;

  constructor(engine: Engine, keyPath: KeyPath) {
    this.#engine = engine;
    this.keyPath = keyPath;
  }

  get path(): IndexPath {
    return this.#engine.indexPath(this.keyPath) ?? [];
  }

  get items(): ReadonlyArray<{
    readonly key: number;
    readonly index: number;
    readonly fields: GroupImpl;
    readonly field: FieldImpl;
  }> {
    const keys = this.#engine.state.keys.get(pathId(this.keyPath)) ?? [];
    return keys.map((key, index) => ({
      field: this.#engine.field([...this.keyPath, key]),
      fields: this.#engine.group([...this.keyPath, key]),
      index,
      key,
    }));
  }

  get error(): string | undefined {
    return this.#engine.errorAt(this.keyPath);
  }

  append(item: unknown): void {
    this.#engine.updateArray(this.keyPath, (items, keys) => {
      items.push(item);
      keys.push(this.#engine.newKey());
    });
  }

  remove(index: number): void {
    this.#engine.updateArray(this.keyPath, (items, keys) => {
      if (index >= 0 && index < items.length) {
        items.splice(index, 1);
        keys.splice(index, 1);
      }
    });
  }

  move(from: number, to: number): void {
    this.#engine.updateArray(this.keyPath, (items, keys) => {
      if (
        from < 0 ||
        from >= items.length ||
        to < 0 ||
        to >= items.length ||
        from === to
      ) {
        return;
      }
      items.splice(to, 0, ...items.splice(from, 1));
      keys.splice(to, 0, ...keys.splice(from, 1));
    });
  }

  replace(index: number, item: unknown): void {
    this.#engine.updateArray(this.keyPath, (items, keys) => {
      if (index >= 0 && index < items.length) {
        items[index] = item;
        // A new item: the old one's errors and touched state don't carry over.
        keys[index] = this.#engine.newKey();
      }
    });
  }
}

export class InstanceImpl extends GroupImpl {
  readonly #onsubmit = (event: Event) => {
    event.preventDefault();
    void this.submit().then((exit) => {
      if (Exit.isFailure(exit)) {
        const error = Cause.findErrorOption(exit.cause);
        if (
          Option.isSome(error) &&
          error.value instanceof FormValidationError
        ) {
          this.focusFirstError();
        }
      }
    });
  };

  constructor(engine: Engine) {
    super(engine, []);
  }

  get values(): unknown {
    return this.engine.values;
  }

  get dirty(): boolean {
    return !equals(this.engine.values, this.engine.state.initial);
  }

  get valid(): boolean {
    const state = this.engine.state;
    return (
      state.checked === this.engine.values &&
      !state.validating &&
      state.issues.size === 0 &&
      state.external.size === 0
    );
  }

  get validating(): boolean {
    return this.engine.state.validating;
  }

  get submitting(): boolean {
    return this.engine.state.submitting;
  }

  get submitResult(): AsyncResult.AsyncResult<unknown, unknown> {
    return this.engine.state.submitResult;
  }

  get rootError(): string | undefined {
    return this.engine.errorAt([]);
  }

  get errors(): ReadonlyArray<{
    readonly path: IndexPath;
    readonly message: string;
  }> {
    const state = this.engine.state;
    const out: { path: IndexPath; message: string }[] = [];
    const seen = new Set<string>();
    const add = (id: string) => {
      if (seen.has(id)) {
        return;
      }
      seen.add(id);
      const keyPath = JSON.parse(id) as KeyPath;
      const message = this.engine.errorAt(keyPath);
      const path = this.engine.indexPath(keyPath);
      if (message !== undefined && path !== undefined) {
        out.push({ message, path });
      }
    };
    add(pathId([]));
    for (const id of state.issues.keys()) {
      add(id);
    }
    for (const id of state.external.keys()) {
      add(id);
    }
    return out;
  }

  get submitCount(): number {
    return this.engine.state.submitCount;
  }

  get validationCount(): number {
    return this.engine.state.validationCount;
  }

  get lastSubmitted(): Option.Option<{
    readonly encoded: unknown;
    readonly decoded: unknown;
  }> {
    return this.engine.state.lastSubmitted;
  }

  get dirtySinceSubmit(): boolean {
    const last = this.engine.state.lastSubmitted;
    return (
      Option.isSome(last) && !equals(this.engine.values, last.value.encoded)
    );
  }

  get attrs() {
    return { novalidate: true, onsubmit: this.#onsubmit } as const;
  }

  submit(args?: unknown): Promise<Exit.Exit<unknown, unknown>> {
    return this.engine.submit(args);
  }

  validate(paths?: ReadonlyArray<string | IndexPath>): Promise<boolean> {
    return this.engine.validate(paths);
  }

  setValues(values: unknown): void {
    this.engine.setValues(values);
  }

  reset(values?: unknown): void {
    this.engine.reset(values);
  }

  revertToLastSubmit(): void {
    this.engine.revertToLastSubmit();
  }

  setErrors(errors: ErrorsInput): void {
    this.engine.setErrors(errors, "manual");
  }

  focusFirstError(): void {
    if (typeof document === "undefined") {
      return;
    }
    for (const { path } of this.errors) {
      if (path.length === 0) {
        continue;
      }
      const keyPath = toKeyPath(this.engine.state.keys, path);
      const element =
        keyPath && document.getElementById(this.engine.elementId(keyPath));
      if (element) {
        element.focus();
        return;
      }
    }
  }

  dispose(): void {
    this.engine.dispose();
  }
}
