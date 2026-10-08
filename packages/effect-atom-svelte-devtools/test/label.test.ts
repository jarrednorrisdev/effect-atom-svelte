import { Schema } from "effect";
import { Atom, AtomRegistry } from "effect/reactivity";
import { describe, expect, test } from "vitest";

import { call, keepAcrossReloads, label } from "../src/internal/label.ts";

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
      { family: true }
    );
    expect(todoAtom(3).label?.[0]).toBe("todoAtom(3)");
    expect(todoAtom(3)).toBe(todoAtom(3));
    const byKey = label(
      Atom.family((key: { readonly id: string }) => Atom.make(key.id)),
      "byKey",
      "/src/a.ts:1:7",
      { family: true }
    );
    expect(byKey({ id: "a".repeat(50) }).label?.[0]).toMatch(
      /^byKey\(\{"id":"a+…\)$/u
    );
  });
});

// A module run, then run again by a hot reload: each run makes its own atom.
const reload = (
  registry: AtomRegistry.AtomRegistry,
  key: string,
  source: string
) => {
  const atom = Atom.make(0);
  keepAcrossReloads(atom, key, source, () => [registry]);
  return atom;
};

describe("keepAcrossReloads", () => {
  test("gives the new atom the value of the one it replaces", () => {
    const registry = AtomRegistry.make();
    const before = reload(registry, "/a.ts#count", "same");
    const release = registry.mount(before);
    registry.set(before, 7);
    const after = reload(registry, "/a.ts#count", "same");
    expect(after).not.toBe(before);
    expect(registry.get(after)).toBe(7);
    release();
    registry.dispose();
  });

  test("starts an edited declaration from its new value", () => {
    const registry = AtomRegistry.make();
    const before = reload(registry, "/a.ts#edited", "old");
    const release = registry.mount(before);
    registry.set(before, 7);
    expect(registry.get(reload(registry, "/a.ts#edited", "new"))).toBe(0);
    release();
    registry.dispose();
  });

  test("leaves a registry that never read the old atom alone", () => {
    const registry = AtomRegistry.make();
    reload(registry, "/a.ts#unread", "same");
    const after = reload(registry, "/a.ts#unread", "same");
    expect(registry.getNodes().has(after)).toBe(false);
    registry.dispose();
  });
});

// A key as the Families page's example uses, and its two ways to give each key an atom.
interface Key {
  readonly doc: number;
  readonly lang: string;
}
const newDraft = () => Atom.make("").pipe(Atom.keepAlive);
const at = "/src/same-key.svelte:9:3";

describe("call", () => {
  test("names a factory's new atom after the call and its arguments", () => {
    const draftAtom = call((_key: Key) => newDraft(), "mapDraftAtom", at);
    expect(draftAtom({ doc: 1, lang: "en" }).label).toEqual([
      'mapDraftAtom({"doc":1,"lang":"en"})',
      `at mapDraftAtom({"doc":1,"lang":"en"}) (${at})`,
    ]);
    const twoArgs = call(
      (_a: number, _b: string) => newDraft(),
      "pairAtom",
      at
    );
    expect(twoArgs(1, "x").label?.[0]).toBe('pairAtom(1, "x")');
  });

  test("leaves the atom a cache returns again with the name it was first given", () => {
    const cache = new Map<number, Atom.Writable<string>>();
    const cached = (id: number) => {
      const atom = cache.get(id) ?? newDraft();
      cache.set(id, atom);
      return atom;
    };
    const first = call(cached, "cachedAtom", at)(1);
    const again = call(cached, "otherAtom", at)(1);
    expect(again).toBe(first);
    expect(again.label?.[0]).toBe("cachedAtom(1)");
  });

  test("gives two atoms made for equal keys the same name", () => {
    const mapDraftAtom = call((_key: Key) => newDraft(), "mapDraftAtom", at);
    const one = mapDraftAtom({ doc: 1, lang: "en" });
    const two = mapDraftAtom({ doc: 1, lang: "en" });
    expect(two).not.toBe(one);
    expect(two.label?.[0]).toBe(one.label?.[0]);
  });

  test("returns a result that isn't an atom as it is", () => {
    const value = { draft: "" };
    expect(call(() => value, "settingsAtom", at)()).toBe(value);
    expect(call(() => 3, "countAtom", at)()).toBe(3);
    const notAFunction = 1 as unknown as () => unknown;
    expect(call(notAFunction, "brokenAtom", at)).toBe(notAFunction);
  });

  test("keeps a more specific label: a family's, one the code set, a top-level name", () => {
    const familyAtom = label(
      Atom.family((_key: number) => newDraft()),
      "draftAtom",
      at,
      { family: true }
    );
    expect(call(familyAtom, "draftAtom", at)(1).label?.[0]).toBe(
      "draftAtom(1)"
    );
    const mine = Atom.make(0).pipe(Atom.withLabel("mine"));
    expect(call(() => mine, "pickAtom", at)().label?.[0]).toBe("mine");
    const shared = label(Atom.make(0), "sharedAtom", at);
    expect(call(() => shared, "pickAtom", at)().label?.[0]).toBe("sharedAtom");
  });

  test("names the atom over a name it was given inside the factory", () => {
    const makeAtom = call(
      (id: number) => label(Atom.make(id), "inner", at, { local: true }),
      "makeAtom",
      at
    );
    expect(makeAtom(4).label?.[0]).toBe("makeAtom(4)");
  });
});
