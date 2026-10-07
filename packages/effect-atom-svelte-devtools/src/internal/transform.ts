// The atomLabels plugin's source transform: wraps each top-level declaration made by a call, such
// as `const todosAtom = Atom.make(...)`, in `label(...)` with the variable's name and where it is
// declared. `label` (./label.ts) decides at run time whether the value is an atom, so the transform
// needn't know what a call returns: `runtime.atom(...)`, `TodosRpc.query(...)` and a helper of the
// app's own are labelled just like `Atom.make(...)`.
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

/** The calls to wrap among a program's top-level statements, offset by `base`. */
const sites = (program: Node, base: number, defaultName: string): Site[] => {
  const found: Site[] = [];
  const declare = (declaration: Node) => {
    if (declaration.type !== "VariableDeclaration") {
      return;
    }
    for (const declarator of declaration.declarations as Node[]) {
      const id = declarator.id as Node;
      const node = call(declarator.init);
      if (id.type === "Identifier" && node) {
        found.push({
          at: base + id.start,
          end: base + node.end,
          family: isFamily(node),
          name: String(id.name),
          start: base + node.start,
        });
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
        found.push({
          at: base + node.start,
          end: base + node.end,
          family: isFamily(node),
          name: defaultName,
          start: base + node.start,
        });
      }
    } else {
      declare(statement);
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
        sites: sites(parse(block.code), block.start, defaultName),
      }));
      found = blocks.flatMap((block) => block.sites);
      // The module script if it declares atoms, as the instance script can see its imports but
      // not the other way round.
      const host =
        blocks.find((block) => block.module && block.sites.length > 0) ??
        blocks.find((block) => block.sites.length > 0);
      importAt = host?.start ?? 0;
    } else {
      found = sites(parse(code), 0, defaultName);
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
    const args = [
      JSON.stringify(site.name),
      JSON.stringify(`${place}:${at(site.at)}`),
      ...(site.family ? ["true"] : []),
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
