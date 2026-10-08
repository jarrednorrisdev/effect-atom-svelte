import { describe, expect, test } from "vitest";

import { labelAtoms } from "../src/internal/transform.ts";

const root = "/app";
const transform = (code: string, file = "/app/src/lib/atoms.ts") =>
  labelAtoms(code, file, root)?.code;

// The import every transformed file starts its labelled script with.
const header =
  'import { label as __effectAtomSvelteLabel } from "virtual:effect-atom-svelte-devtools/label";';

/** The hash a declaration is kept across reloads by, if it is. */
const keep = (code: string) =>
  /"keep":"(?<hash>\w+)"/u.exec(transform(code) ?? "")?.groups?.hash;

/** Whether the transform keeps a declaration across reloads. */
const kept = (code: string, file?: string) =>
  transform(code, file)?.includes('"keep"');

describe("labelAtoms", () => {
  test("wraps a top-level declaration made by a call, with its name and place", () => {
    expect(transform("export const countAtom = Atom.make(load);")).toBe(
      `${header}export const countAtom = __effectAtomSvelteLabel(Atom.make(load), "countAtom", "/src/lib/atoms.ts:1:14");`
    );
  });

  test("wraps a whole .pipe chain and every declarator of a declaration", () => {
    const code = [
      "const a = Atom.make(load).pipe(Atom.keepAlive),",
      "  b = runtime.atom(effect);",
    ].join("\n");
    expect(transform(code)).toBe(
      [
        `${header}const a = __effectAtomSvelteLabel(Atom.make(load).pipe(Atom.keepAlive), "a", "/src/lib/atoms.ts:1:7"),`,
        '  b = __effectAtomSvelteLabel(runtime.atom(effect), "b", "/src/lib/atoms.ts:2:3");',
      ].join("\n")
    );
  });

  test("looks through type assertions to the call", () => {
    expect(
      transform("const a = Atom.make(load) as Atom.Writable<number>;")
    ).toBe(
      `${header}const a = __effectAtomSvelteLabel(Atom.make(load), "a", "/src/lib/atoms.ts:1:7") as Atom.Writable<number>;`
    );
  });

  test("marks a family, so its members are labelled", () => {
    expect(
      transform("const todoAtom = Atom.family((id: number) => Atom.make(id));")
    ).toContain('"todoAtom", "/src/lib/atoms.ts:1:7", {"family":true})');
  });

  test("names a default export after its file", () => {
    expect(
      transform("export default Atom.make(load);", "/app/src/count.ts")
    ).toBe(
      `${header}export default __effectAtomSvelteLabel(Atom.make(load), "count", "/src/count.ts:1:16");`
    );
  });

  test("leaves runes, hooks, values that aren't calls and destructuring alone", () => {
    expect(
      transform(
        [
          "let count = $state(0);",
          "const double = $derived.by(() => count * 2);",
          "const todos = useAtomValue(todosAtom);",
          "const atom = otherAtom;",
          "const { a } = make();",
          "const { b: c } = { b: Atom.make(0) };",
        ].join("\n")
      )
    ).toBeUndefined();
  });

  test("names atoms in a top-level object literal after their path", () => {
    const code = [
      "export const pair = {",
      "  log: [],",
      "  todosAtom: Atom.make(0),",
      '  nested: { "userAtom": runtime.atom(effect) },',
      "  [computed]: Atom.make(1),",
      "};",
    ].join("\n");
    const output = transform(code);
    expect(output).toContain(
      '__effectAtomSvelteLabel(Atom.make(0), "pair.todosAtom", "/src/lib/atoms.ts:3:3"'
    );
    expect(output).toContain(
      '__effectAtomSvelteLabel(runtime.atom(effect), "pair.nested.userAtom", "/src/lib/atoms.ts:4:13"'
    );
    expect(output).toContain("[computed]: Atom.make(1),");
  });

  test("labels Atom.* calls declared in functions, and only those", () => {
    const code = [
      "export function makeForm(initial: string) {",
      "  const valueAtom = Atom.make(initial);",
      "  const other = helper();",
      "  return { valueAtom, other };",
      "}",
    ].join("\n");
    const output = transform(code);
    expect(output).toContain(
      '__effectAtomSvelteLabel(Atom.make(initial), "valueAtom", "/src/lib/atoms.ts:2:9")'
    );
    expect(output).toContain("const other = helper();");
  });

  test("labels an atom declared inside another atom's call", () => {
    const output = transform(
      "const a = Atom.make((get) => { const b = Atom.make(1); return get(b); });"
    );
    expect(output).toBe(
      `${header}const a = __effectAtomSvelteLabel(Atom.make((get) => { const b = __effectAtomSvelteLabel(Atom.make(1), "b", "/src/lib/atoms.ts:1:38"); return get(b); }), "a", "/src/lib/atoms.ts:1:7");`
    );
  });

  test("leaves code that doesn't parse alone", () => {
    expect(transform("const a = (")).toBeUndefined();
  });

  test("labels both scripts of a component, importing in the module script", () => {
    const code = [
      '<script lang="ts" module>',
      "  export const shared = Atom.make(load);",
      "</script>",
      "",
      '<script lang="ts">',
      "  const { start }: { start: number } = $props();",
      "  const local = Atom.make(start);",
      "</script>",
      "",
      "<p>{start}</p>",
    ].join("\n");
    expect(transform(code, "/app/src/routes/Counter.svelte")).toBe(
      [
        `<script lang="ts" module>${header}`,
        '  export const shared = __effectAtomSvelteLabel(Atom.make(load), "shared", "/src/routes/Counter.svelte:2:16");',
        "</script>",
        "",
        '<script lang="ts">',
        "  const { start }: { start: number } = $props();",
        '  const local = __effectAtomSvelteLabel(Atom.make(start), "local", "/src/routes/Counter.svelte:7:9");',
        "</script>",
        "",
        "<p>{start}</p>",
      ].join("\n")
    );
  });

  test("ignores a script in a component's comment", () => {
    const code = [
      "<!-- <script>const a = Atom.make(0);</script> -->",
      "<script>",
      "  const b = Atom.make(1);",
      "</script>",
    ].join("\n");
    const output = transform(code, "/app/src/A.svelte");
    expect(output).toContain('"b", "/src/A.svelte:3:9")');
    expect(output).not.toContain('"a"');
  });

  test("marks the state atoms a module declares to keep across reloads, with a hash of each", () => {
    const zero = keep("export const countAtom = Atom.make(0);");
    expect(zero).toBeDefined();
    expect(keep("export const countAtom = Atom.make(0);")).toBe(zero);
    expect(keep("export const countAtom = Atom.make(5);")).not.toBe(zero);
    for (const value of ["[]", "{ open: false }", "`a`", "-1", "true"]) {
      expect(keep(`const a = Atom.make(${value});`)).toBeDefined();
    }
    expect(keep("const a = Atom.make([]).pipe(Atom.keepAlive);")).toBeDefined();
    expect(keep("const a = { b: Atom.make(0) };")).toBeDefined();
  });

  test("keeps only state atoms, and only those that run once per module", () => {
    expect(kept("const a = Atom.make(() => 0);")).toBe(false);
    expect(kept("const a = Atom.make(Effect.succeed(0));")).toBe(false);
    expect(kept("const a = Atom.make(initial);")).toBe(false);
    expect(kept("const a = runtime.atom(0);")).toBe(false);
    expect(kept("function f() { const a = Atom.make(0); }")).toBe(false);
    expect(
      kept("<script>const a = Atom.make(0);</script>", "/app/A.svelte")
    ).toBe(false);
    expect(
      kept("<script module>const a = Atom.make(0);</script>", "/app/A.svelte")
    ).toBe(true);
  });

  test("addresses a file outside the root by its full path", () => {
    expect(
      transform("const a = Atom.make(0);", "/elsewhere/atoms.ts")
    ).toContain('"/elsewhere/atoms.ts:1:7"');
  });
});
