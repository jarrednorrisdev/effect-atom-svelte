// Fields under one path of a form. Internal: not exported from the package.
import type { ArrayImpl } from "./array.ts";
import type { Engine } from "./engine.ts";
import type { FieldImpl } from "./field.ts";
import type { IndexPath, KeyPath } from "./paths.ts";

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
