import { Schema } from "effect";
import { Atom, AtomRegistry } from "effect/reactivity";
import { describe, expect, test } from "vitest";

import { label } from "../src/internal/label.ts";

const f = () => 1;

describe("label", () => {
  test("labels an atom in place, with a stack frame for where it is declared", () => {
    const atom = Atom.make(0);
    expect(label(atom, "countAtom", "/src/a.ts:1:14")).toBe(atom);
    expect(atom.label).toEqual(["countAtom", "at countAtom (/src/a.ts:1:14)"]);
    expect(AtomRegistry.make().get(atom)).toBe(0);
  });

  test("passes anything else through", () => {
    const value = { a: 1 };
    expect(label(f, "f", "/src/a.ts:1:1")).toBe(f);
    expect(label(value, "value", "/src/a.ts:1:1")).toBe(value);
    expect(label(null, "nothing", "/src/a.ts:1:1")).toBeNull();
  });

  test("keeps a label the code set itself", () => {
    const atom = Atom.make(0).pipe(Atom.withLabel("mine"));
    label(atom, "countAtom", "/src/a.ts:1:14");
    expect(atom.label?.[0]).toBe("mine");
  });

  test("replaces the label a serializable atom takes from its key", () => {
    const atom = Atom.make(0).pipe(
      Atom.serializable({ key: "count", schema: Schema.Number })
    );
    expect(atom.label?.[0]).toBe("count");
    label(atom, "countAtom", "/src/a.ts:1:14");
    expect(atom.label?.[0]).toBe("countAtom");
  });

  test("labels a family's members with their argument", () => {
    const todoAtom = label(
      Atom.family((id: number) => Atom.make(id)),
      "todoAtom",
      "/src/a.ts:1:7",
      true
    );
    expect(todoAtom(3).label?.[0]).toBe("todoAtom(3)");
    expect(todoAtom(3)).toBe(todoAtom(3));
    const byKey = label(
      Atom.family((key: { readonly id: string }) => Atom.make(key.id)),
      "byKey",
      "/src/a.ts:1:7",
      true
    );
    expect(byKey({ id: "a".repeat(50) }).label?.[0]).toMatch(
      /^byKey\(\{"id":"a+…\)$/u
    );
  });
});
