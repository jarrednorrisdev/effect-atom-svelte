// One field of a form. Internal: not exported from the package.
import type { Constraints } from "./constraints.ts";
import type { Engine } from "./engine.ts";
import { equals, getIn, nameOf, pathId } from "./paths.ts";
import type { IndexPath, KeyPath } from "./paths.ts";

export class FieldImpl {
  readonly #engine: Engine;
  readonly keyPath: KeyPath;
  readonly #onblur = () => {
    this.#engine.leave(this.keyPath);
  };

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

  get issue(): string | undefined {
    return this.#engine.state.issues.get(pathId(this.keyPath));
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
      onblur: this.#onblur,
    } as const;
  }

  get constraints(): Constraints {
    return this.#engine.constraints(this.path);
  }

  /** What leaving the field does, for a custom control with no blur event of its own. */
  blur(): void {
    this.#onblur();
  }
}
