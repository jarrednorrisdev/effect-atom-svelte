import { describe, expect, test } from "vitest";

import { componentName, labelAtoms } from "../src/internal/transform.ts";

const root = "/app";
const transform = (code: string, file = "/app/src/lib/atoms.ts") =>
  labelAtoms(code, file, root)?.code;

// The import every transformed file starts its labelled script with.
const header =
  'import { label as __effectAtomSvelteLabel } from "virtual:effect-atom-svelte-devtools/label";';

// What starts every component's instance script: its name, for inspector scopes.
const naming = (name: string, file: string) =>
  `import { component as __effectAtomSvelteComponent } from "virtual:effect-atom-svelte-devtools/label";__effectAtomSvelteComponent(${JSON.stringify(name)}, ${JSON.stringify(file)});`;

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
      '__effectAtomSvelteLabel(Atom.make(initial), "valueAtom", "/src/lib/atoms.ts:2:9", {"local":true})'
    );
    expect(output).toContain("const other = helper();");
  });

  test("labels an atom declared inside another atom's call", () => {
    const output = transform(
      "const a = Atom.make((get) => { const b = Atom.make(1); return get(b); });"
    );
    expect(output).toBe(
      `${header}const a = __effectAtomSvelteLabel(Atom.make((get) => { const b = __effectAtomSvelteLabel(Atom.make(1), "b", "/src/lib/atoms.ts:1:38", {"local":true}); return get(b); }), "a", "/src/lib/atoms.ts:1:7");`
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
        `<script lang="ts">${naming("Counter", "/src/routes/Counter.svelte")}`,
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

  test("names a component that declares no atoms, in its instance script only", () => {
    expect(
      transform(
        '<script module>export const x = 1;</script><script lang="ts">let a = $state(0);</script><p>{a}</p>',
        "/app/src/lib/todo-list.svelte"
      )
    ).toBe(
      `<script module>export const x = 1;</script><script lang="ts">${naming("TodoList", "/src/lib/todo-list.svelte")}let a = $state(0);</script><p>{a}</p>`
    );
    expect(transform("<p>no script</p>", "/app/src/A.svelte")).toBeUndefined();
  });

  test("names components as Svelte does", () => {
    expect(componentName("/a/counter.svelte")).toBe("Counter");
    expect(componentName("/a/create-and-read.svelte")).toBe("CreateAndRead");
    expect(componentName("/a/+page.svelte")).toBe("Page");
    expect(componentName("/a/HeroGraph.svelte")).toBe("HeroGraph");
  });

  test("wraps each call to a function named like an atom factory, wherever it is", () => {
    const code = [
      "const pick = (key) => mapDraftAtom(key);",
      "use(todoAtom(1), makeSessionAtom(user));",
      "useAtom(x); isAtom(x); Atom(x); store.todoAtom(1); atomic(1);",
    ].join("\n");
    expect(transform(code)).toBe(
      [
        'import { call as __effectAtomSvelteCall } from "virtual:effect-atom-svelte-devtools/label";const pick = (key) => __effectAtomSvelteCall(mapDraftAtom, "mapDraftAtom", "/src/lib/atoms.ts:1:23")(key);',
        'use(__effectAtomSvelteCall(todoAtom, "todoAtom", "/src/lib/atoms.ts:2:5")(1), __effectAtomSvelteCall(makeSessionAtom, "makeSessionAtom", "/src/lib/atoms.ts:2:18")(user));',
        "useAtom(x); isAtom(x); Atom(x); store.todoAtom(1); atomic(1);",
      ].join("\n")
    );
  });

  test("wraps a factory's call inside a declaration that labels it", () => {
    expect(transform("const draft = mapDraftAtom(key);")).toBe(
      'import { label as __effectAtomSvelteLabel, call as __effectAtomSvelteCall } from "virtual:effect-atom-svelte-devtools/label";const draft = __effectAtomSvelteLabel(__effectAtomSvelteCall(mapDraftAtom, "mapDraftAtom", "/src/lib/atoms.ts:1:15")(key), "draft", "/src/lib/atoms.ts:1:7");'
    );
  });

  test("addresses a file outside the root by its full path, as /@fs/ does", () => {
    expect(
      transform("const a = Atom.make(0);", "/elsewhere/atoms.ts")
    ).toContain('"/@fs/elsewhere/atoms.ts:1:7"');
  });

  test("finds the instance script's code after a generics attribute holding >", () => {
    const component = `<script lang="ts" generics="T extends Record<string, number>">
  const countAtom = Atom.make(0);
</script>
<p>hi</p>`;
    const output = transform(component, "/app/src/lib/counter.svelte") ?? "";
    expect(output).toContain('generics="T extends Record<string, number>">');
    expect(output).toContain(
      "const countAtom = __effectAtomSvelteLabel(Atom.make(0), "
    );
  });

  test("leaves a script in <svelte:head> alone: it's page HTML, not the component's code", () => {
    const component = [
      "<svelte:head>",
      "  <script>window.dataLayer = window.dataLayer || [];</script>",
      "</svelte:head>",
      "<p>hi</p>",
    ].join("\n");
    // An import put in the head script would be a SyntaxError when the page loads.
    expect(
      transform(component, "/app/src/lib/counter.svelte") ?? component
    ).not.toContain("import {");
  });

  test("labels the instance script of a component with a JSON-LD script in <svelte:head>", () => {
    const component = [
      '<script lang="ts">',
      "  const countAtom = Atom.make(0);",
      "</script>",
      "<svelte:head>",
      '  <script type="application/ld+json">{ "@context": "https://schema.org" }</script>',
      "</svelte:head>",
    ].join("\n");
    expect(transform(component, "/app/src/lib/counter.svelte")).toContain(
      "__effectAtomSvelteLabel(Atom.make(0)"
    );
  });

  test("labels the instance script after a comment that mentions <svelte:head>", () => {
    const component = [
      "<!-- The title moved out of <svelte:head> into the layout. -->",
      '<script lang="ts">',
      "  const countAtom = Atom.make(0);",
      "</script>",
      "<svelte:head>",
      "  <title>Counter</title>",
      "</svelte:head>",
    ].join("\n");
    const out = transform(component, "/app/src/lib/counter.svelte");
    expect(out).toContain("__effectAtomSvelteLabel(Atom.make(0)");
    // One instance script, not a second one added for the component's name.
    expect(out?.match(/<script/gu)?.length).toBe(1);
  });
});

describe("keeping state across hot reloads, through a pipe", () => {
  // A mapped atom writes through to its source, so carrying its value over would write the mapped
  // value into the source: `Atom.make(1).pipe(Atom.map((n) => n * 2))` set to 5 reads 10, and read
  // 20 after a reload.
  test("keeps only a pipe of Atom.make that leaves it a state atom", () => {
    expect(keep("const a = Atom.make(0).pipe(Atom.keepAlive);")).toBeDefined();
    expect(
      keep("const a = Atom.make(1).pipe(Atom.map((n) => n * 2));")
    ).toBeUndefined();
    expect(
      keep("const a = Atom.make([]).pipe(Atom.optimistic);")
    ).toBeUndefined();
  });

  // These return a copy of the same state atom, as keepAlive does.
  test("keeps a pipe of Atom.make through setLazy, withEquality or withServerValue", () => {
    expect(
      keep("const a = Atom.make(0).pipe(Atom.setLazy(false));")
    ).toBeDefined();
    expect(
      keep(
        "const a = Atom.make({ n: 0 }).pipe(Atom.withEquality((x, y) => x.n === y.n));"
      )
    ).toBeDefined();
    expect(
      keep(
        'const a = Atom.make("dark").pipe(Atom.withServerValue(() => "light"));'
      )
    ).toBeDefined();
  });
});
