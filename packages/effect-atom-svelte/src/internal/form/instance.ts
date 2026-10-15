// A form instance: the root group, with the form's state and actions. Internal: `Form.ts` types it.
import { Cause, Exit, Option } from "effect";
import type { AsyncResult } from "effect/reactivity";

import type { Engine } from "./engine.ts";
import { GroupImpl } from "./group.ts";
import { equals, fromPathId, pathId, toKeyPath } from "./paths.ts";
import type { IndexPath } from "./paths.ts";
import type { ErrorsInput } from "./types.ts";
import { FormValidationError } from "./validationError.ts";

export class InstanceImpl extends GroupImpl {
  readonly #onsubmit = (event: Event) => {
    event.preventDefault();
    void this.#submitAndFocus();
  };

  // oxlint-disable-next-line effecttsgo/async-function -- the form's submit handler, which awaits the Promise-facing submit, outside any Effect program
  async #submitAndFocus(): Promise<void> {
    const exit = await this.submit();
    if (Exit.isFailure(exit)) {
      const error = Cause.findErrorOption(exit.cause);
      if (Option.isSome(error) && error.value instanceof FormValidationError) {
        this.focusFirstError();
      }
    }
  }

  constructor(engine: Engine) {
    super(engine, []);
  }

  get values(): unknown {
    return this.engine.values;
  }

  get initialValues(): unknown {
    return this.engine.state.initial;
  }

  get dirty(): boolean {
    return !equals(this.engine.values, this.engine.state.initial);
  }

  get valid(): boolean {
    const { state } = this.engine;
    const current = state.checked === this.engine.values && !state.validating;
    return (
      current &&
      state.failure === undefined &&
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

  get errors(): readonly {
    readonly path: IndexPath;
    readonly message: string;
  }[] {
    const { state } = this.engine;
    const out: { path: IndexPath; message: string }[] = [];
    const seen = new Set<string>();
    const add = (id: string) => {
      if (seen.has(id)) {
        return;
      }
      seen.add(id);
      const keyPath = fromPathId(id);
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

  validate(paths?: readonly (string | IndexPath)[]): Promise<boolean> {
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
    // The ids of the fields showing an error, as in `field.attrs`.
    const selectors: string[] = [];
    for (const { path } of this.errors) {
      const keyPath =
        path.length === 0 ? undefined : toKeyPath(this.engine.state.keys, path);
      if (keyPath !== undefined) {
        selectors.push(`#${CSS.escape(this.engine.elementId(keyPath))}`);
      }
    }
    if (selectors.length === 0) {
      return;
    }
    // querySelector finds the first match in document order: the first on the page, which may not
    // be the Schema's first, as for a `{ city, street }` laid out street first. A field whose
    // element isn't on the page is skipped.
    document.querySelector<HTMLElement>(selectors.join(","))?.focus();
  }

  dispose(): void {
    this.engine.dispose();
  }
}
