// The atomLabels plugin's source transform: wraps each top-level declaration made by a call, such
// as `const todosAtom = Atom.make(...)`, in `label(...)` with the variable's name and where it is
// declared. `label` (./label.ts) decides at run time whether the value is an atom, so the transform
// needn't know what a call returns: `runtime.atom(...)`, `TodosRpc.query(...)` and a helper of the
// app's own are labelled just like `Atom.make(...)`. Inside functions, where wrapping every call
// would be noise, only `Atom.*` calls are.
//
// The parser is the one Svelte uses for scripts (acorn with TypeScript), so this works with any
// Vite version and needs no native binary.
import path from "node:path";

import { tsPlugin } from "@sveltejs/acorn-typescript";
import { Parser } from "acorn";
import MagicString from "magic-string";

/** The id the transformed code imports `label` from; the plugin resolves it to ./label.ts. */
export const labelModule = "virtual:effect-atom-svelte-devtools/label";

const labelBinding = "__effectAtomSvelteLabel";

const parser = Parser.extend(tsPlugin());

/** The few ESTree and TypeScript node shapes the transform looks at. */
interface Node {
  readonly type: string;
  readonly start: number;
  readonly end: number;
  readonly [key: string]: unknown;
}

/** A call to wrap: the source range of the call, the name it is labelled with, and its place. */
interface Site {
  readonly start: number;
  readonly end: number;
  readonly name: string;
  /** Offset of the declared name, which `at` points at. */
  readonly at: number;
  readonly family: boolean;
  /** Whether a hot reload carries its value over to the atom that replaces it. */
  readonly keep: boolean;
}

// Type annotations around the call, as in `Atom.make(0) as Atom.Writable<number>`, are looked
// through: only the call is wrapped.
const wrappers = new Set([
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSNonNullExpression",
  "TSTypeAssertion",
  "ParenthesizedExpression",
]);

const unwrap = (node: Node): Node =>
  wrappers.has(node.type) ? unwrap(node.expression as Node) : node;

/** The identifier a callee chain starts from: `Atom` in `Atom.make(...).pipe(...)`. */
const chainStart = (node: Node): Node => {
  if (node.type === "MemberExpression") {
    return chainStart(node.object as Node);
  }
  if (node.type === "CallExpression") {
    return chainStart(node.callee as Node);
  }
  return wrappers.has(node.type) ? chainStart(node.expression as Node) : node;
};

/**
 * A call to wrap, or `undefined`. Svelte's runes (`$state(...)`, `$derived.by(...)`) must stay as
 * they are, and hooks (`useAtomValue(...)`) never return an atom, so both are left be.
 */
const call = (init: unknown): Node | undefined => {
  if (init === null || init === undefined) {
    return undefined;
  }
  const node = unwrap(init as Node);
  if (node.type !== "CallExpression") {
    return undefined;
  }
  const start = chainStart(node.callee as Node);
  if (
    start.type === "Identifier" &&
    /^(?:\$|use[A-Z])/u.test(String(start.name))
  ) {
    return undefined;
  }
  return node;
};

/** Whether the call is `Atom.family(...)` (or a bare `family(...)`), whose members are labelled. */
const isFamily = (node: Node): boolean => {
  const callee = node.callee as Node;
  const property =
    callee.type === "MemberExpression" ? (callee.property as Node) : callee;
  return property.type === "Identifier" && property.name === "family";
};

// The arguments `Atom.make` takes as a plain value, rather than a function or an effect.
const plainValues = new Set([
  "Literal",
  "TemplateLiteral",
  "ObjectExpression",
  "ArrayExpression",
  "UnaryExpression",
]);

/**
 * Whether the call makes a state atom, such as `Atom.make(0)` or `Atom.make([]).pipe(...)`: one
 * that holds what is written to it, which a hot reload can carry over.
 */
const isState = (node: Node): boolean => {
  const callee = node.callee as Node;
  if (callee.type !== "MemberExpression") {
    return false;
  }
  const object = callee.object as Node;
  const property = callee.property as Node;
  if (property.type === "Identifier" && property.name === "pipe") {
    return object.type === "CallExpression" && isState(object);
  }
  const [argument] = node.arguments as Node[];
  return (
    object.type === "Identifier" &&
    object.name === "Atom" &&
    property.type === "Identifier" &&
    property.name === "make" &&
    argument !== undefined &&
    plainValues.has(unwrap(argument).type)
  );
};

/** A property's name, when it is written out: `todosAtom` in `{ todosAtom: ... }`. */
const propertyName = (property: Node): string | undefined => {
  const key = property.key as Node;
  if (property.computed) {
    return undefined;
  }
  if (key.type === "Identifier") {
    return String(key.name);
  }
  return key.type === "Literal" && typeof key.value === "string"
    ? key.value
    : undefined;
};

/** Every node below `node`, depth first. */
const descendants = (node: Node, found: Node[] = []): Node[] => {
  for (const value of Object.values(node)) {
    const children = Array.isArray(value) ? value : [value];
    for (const child of children) {
      if (typeof child === "object" && child !== null && "type" in child) {
        found.push(child as Node);
        descendants(child as Node, found);
      }
    }
  }
  return found;
};

/**
 * The calls to wrap in a program, offset by `base`: every call its top-level declarations make,
 * also inside object literals (`oneByOne.todosAtom` in `const oneByOne = { todosAtom: ... }`), and
 * any `Atom.*` call declared elsewhere, such as in a function that makes atoms.
 *
 * `once` says the program runs once per module, as a module or a `<script module>` does, not once
 * per component; only then are state atoms its top level declares kept across hot reloads.
 */
const sites = (
  program: Node,
  base: number,
  defaultName: string,
  once: boolean
): Site[] => {
  const found: Site[] = [];
  const handled = new Set<Node>();
  const add = (node: Node, name: string, at: number, topLevel = true) => {
    found.push({
      at: base + at,
      end: base + node.end,
      family: isFamily(node),
      keep: once && topLevel && isState(node),
      name,
      start: base + node.start,
    });
  };
  const members = (object: Node, prefix: string) => {
    for (const property of object.properties as Node[]) {
      const key =
        property.type === "Property" ? propertyName(property) : undefined;
      if (key === undefined) {
        continue;
      }
      const value = unwrap(property.value as Node);
      const node = call(value);
      if (node) {
        add(node, `${prefix}.${key}`, (property.key as Node).start);
      } else if (value.type === "ObjectExpression") {
        members(value, `${prefix}.${key}`);
      }
    }
  };
  const declare = (declaration: Node) => {
    if (declaration.type !== "VariableDeclaration") {
      return;
    }
    for (const declarator of declaration.declarations as Node[]) {
      handled.add(declarator);
      const id = declarator.id as Node;
      if (id.type !== "Identifier" || !declarator.init) {
        continue;
      }
      const init = unwrap(declarator.init as Node);
      const node = call(init);
      if (node) {
        add(node, String(id.name), id.start);
      } else if (init.type === "ObjectExpression") {
        members(init, String(id.name));
      }
    }
  };
  for (const statement of program.body as Node[]) {
    if (statement.type === "ExportNamedDeclaration") {
      const { declaration } = statement;
      if (declaration) {
        declare(declaration as Node);
      }
    } else if (statement.type === "ExportDefaultDeclaration") {
      const node = call(statement.declaration);
      if (node) {
        add(node, defaultName, node.start);
      }
    } else {
      declare(statement);
    }
  }
  for (const node of descendants(program)) {
    if (node.type !== "VariableDeclarator" || handled.has(node)) {
      continue;
    }
    const id = node.id as Node;
    const init = node.init ? call(node.init) : undefined;
    const start = init ? chainStart(init.callee as Node) : undefined;
    if (
      id.type === "Identifier" &&
      init &&
      start?.type === "Identifier" &&
      start.name === "Atom"
    ) {
      add(init, String(id.name), id.start, false);
    }
  }
  return found;
};

const parse = (code: string): Node =>
  parser.parse(code, {
    ecmaVersion: "latest",
    sourceType: "module",
  }) as unknown as Node;

// Svelte's own pattern for finding scripts to preprocess (svelte/src/compiler/preprocess).
const scriptPattern =
  /<!--[^]*?-->|<script(?<attributes>(?:\s+[^=>'"/\s]+=(?:"[^"]*"|'[^']*'|[^>\s]+)|\s+[^=>'"/\s]+)*\s*)(?:\/>|>(?<code>[\S\s]*?)<\/script>)/gu;

/** The scripts of a component: where each one's code starts, the code, and if it is the module script. */
const scripts = (source: string) => {
  const found: { start: number; code: string; module: boolean }[] = [];
  for (const match of source.matchAll(scriptPattern)) {
    const [whole] = match;
    const { attributes, code } = match.groups ?? {};
    if (attributes === undefined || code === undefined) {
      continue;
    }
    found.push({
      code,
      module: /\bmodule\b/u.test(attributes),
      start: match.index + whole.indexOf(">") + 1,
    });
  }
  return found;
};

/** 1-based line and column of each offset, from a table of where lines start. */
const locate = (source: string) => {
  const starts = [0];
  for (const match of source.matchAll(/\n/gu)) {
    starts.push(match.index + 1);
  }
  return (offset: number) => {
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if ((starts[middle] ?? 0) <= offset) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }
    return `${low + 1}:${offset - (starts[low] ?? 0) + 1}`;
  };
};

/** A short hash of some source, to tell whether it changed. */
const hash = (text: string): string => {
  let value = 0;
  for (let index = 0; index < text.length; index += 1) {
    // Modulo the largest prime below 2^32, so the product stays an exact integer.
    value = (value * 31 + (text.codePointAt(index) ?? 0)) % 4_294_967_291;
  }
  return value.toString(36);
};

/** Where a file is, as the dev server addresses it: relative to `root`, with forward slashes. */
const address = (file: string, root: string): string => {
  const relative = path.relative(root, file);
  const inside = !relative.startsWith("..") && !path.isAbsolute(relative);
  return (inside ? `/${relative}` : file).replaceAll("\\", "/");
};

/**
 * Labels the atoms declared at the top level of a module or of a component's scripts. Returns the
 * new code and its source map, or `undefined` when there is nothing to label or the code doesn't
 * parse (a component whose script needs a preprocessor, say), which leaves the file as it is.
 */
export const labelAtoms = (
  code: string,
  file: string,
  root: string
):
  | { code: string; map: ReturnType<MagicString["generateMap"]> }
  | undefined => {
  const svelte = file.endsWith(".svelte");
  const defaultName = path.basename(file).replace(/\..*$/u, "");
  let found: Site[] = [];
  // Where the import of `label` goes.
  let importAt = 0;
  try {
    if (svelte) {
      const blocks = scripts(code).map((block) => ({
        ...block,
        sites: sites(parse(block.code), block.start, defaultName, block.module),
      }));
      found = blocks.flatMap((block) => block.sites);
      // The module script if it declares atoms, as the instance script can see its imports but
      // not the other way round.
      const host =
        blocks.find((block) => block.module && block.sites.length > 0) ??
        blocks.find((block) => block.sites.length > 0);
      importAt = host?.start ?? 0;
    } else {
      found = sites(parse(code), 0, defaultName, true);
      importAt = code.startsWith("#!") ? code.indexOf("\n") + 1 : 0;
    }
  } catch {
    return undefined;
  }
  if (found.length === 0) {
    return undefined;
  }

  const at = locate(code);
  const place = address(file, root);
  const output = new MagicString(code);
  output.appendLeft(
    importAt,
    `import { label as ${labelBinding} } from ${JSON.stringify(labelModule)};`
  );
  for (const site of found) {
    const options = {
      ...(site.family ? { family: true } : {}),
      // The declaration's source, hashed: an edit to it means the old value no longer applies.
      ...(site.keep ? { keep: hash(code.slice(site.start, site.end)) } : {}),
    };
    const args = [
      JSON.stringify(site.name),
      JSON.stringify(`${place}:${at(site.at)}`),
      ...(site.family || site.keep ? [JSON.stringify(options)] : []),
    ];
    output.appendLeft(site.start, `${labelBinding}(`);
    output.appendRight(site.end, `, ${args.join(", ")})`);
  }
  return {
    code: output.toString(),
    map: output.generateMap({
      hires: "boundary",
      includeContent: true,
      source: file,
    }),
  };
};
