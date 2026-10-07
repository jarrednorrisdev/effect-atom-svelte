import { describe, expect, test } from "vitest";

import { labelAtoms } from "../src/internal/transform.ts";

const root = "/app";
const transform = (code: string, file = "/app/src/lib/atoms.ts") =>
  labelAtoms(code, file, root)?.code;

// The import every transformed file starts its labelled script with.
const header =
  'import { label as __effectAtomSvelteLabel } from "virtual:effect-atom-svelte-devtools/label";';

describe("labelAtoms", () => {
  test("wraps a top-level declaration made by a call, with its name and place", () => {
    expect(transform("export const countAtom = Atom.make(0);")).toBe(
      `${header}export const countAtom = __effectAtomSvelteLabel(Atom.make(0), "countAtom", "/src/lib/atoms.ts:1:14");`
    );
  });

  test("wraps a whole .pipe chain and every declarator of a declaration", () => {
    const code = [
      "const a = Atom.make(0).pipe(Atom.keepAlive),",
      "  b = runtime.atom(effect);",
    ].join("\n");
    expect(transform(code)).toBe(
      [
        `${header}const a = __effectAtomSvelteLabel(Atom.make(0).pipe(Atom.keepAlive), "a", "/src/lib/atoms.ts:1:7"),`,
        '  b = __effectAtomSvelteLabel(runtime.atom(effect), "b", "/src/lib/atoms.ts:2:3");',
      ].join("\n")
    );
  });

  test("looks through type assertions to the call", () => {
    expect(transform("const a = Atom.make(0) as Atom.Writable<number>;")).toBe(
      `${header}const a = __effectAtomSvelteLabel(Atom.make(0), "a", "/src/lib/atoms.ts:1:7") as Atom.Writable<number>;`
    );
  });

  test("marks a family, so its members are labelled", () => {
    expect(
      transform("const todoAtom = Atom.family((id: number) => Atom.make(id));")
    ).toContain('"todoAtom", "/src/lib/atoms.ts:1:7", true)');
  });

  test("names a default export after its file", () => {
    expect(transform("export default Atom.make(0);", "/app/src/count.ts")).toBe(
      `${header}export default __effectAtomSvelteLabel(Atom.make(0), "count", "/src/count.ts:1:16");`
    );
  });

  test("leaves runes, hooks, values that aren't calls, nested scopes and destructuring alone", () => {
    expect(
      transform(
        [
          "let count = $state(0);",
          "const double = $derived.by(() => count * 2);",
          "const todos = useAtomValue(todosAtom);",
          "const atom = otherAtom;",
          "const { a } = make();",
          "function f() { const inner = Atom.make(0); }",
        ].join("\n")
      )
    ).toBeUndefined();
  });

  test("leaves code that doesn't parse alone", () => {
    expect(transform("const a = (")).toBeUndefined();
  });

  test("labels both scripts of a component, importing in the module script", () => {
    const code = [
      '<script lang="ts" module>',
      "  export const shared = Atom.make(0);",
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
        '  export const shared = __effectAtomSvelteLabel(Atom.make(0), "shared", "/src/routes/Counter.svelte:2:16");',
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

  test("addresses a file outside the root by its full path", () => {
    expect(
      transform("const a = Atom.make(0);", "/elsewhere/atoms.ts")
    ).toContain('"/elsewhere/atoms.ts:1:7"');
  });
});
