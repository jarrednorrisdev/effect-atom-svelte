// An array in a form, whose operations keep each item's state with it. Internal: not exported.
import type { Engine } from "./engine.ts";
import type { FieldImpl } from "./field.ts";
import type { GroupImpl } from "./group.ts";
import { pathId } from "./paths.ts";
import type { IndexPath, KeyPath } from "./paths.ts";

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

  get items(): readonly {
    readonly key: number;
    readonly index: number;
    readonly fields: GroupImpl;
    readonly field: FieldImpl;
  }[] {
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
      const inRange = (index: number) => index >= 0 && index < items.length;
      if (!(inRange(from) && inRange(to)) || from === to) {
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
