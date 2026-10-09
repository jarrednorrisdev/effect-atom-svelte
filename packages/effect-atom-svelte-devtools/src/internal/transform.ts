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
import { parse as parseComponent } from "svelte/compiler";

/** The id the transformed code imports `label` from; the plugin resolves it to ./label.ts. */
export const labelModule = "virtual:effect-atom-svelte-devtools/label";

const labelBinding = "__effectAtomSvelteLabel";
const componentBinding = "__effectAtomSvelteComponent";
const callBinding = "__effectAtomSvelteCall";

/** A component's name from its file, as Svelte names it: `counter-list.svelte` is `CounterList`. */
export const componentName = (file: string): string =>
  path
    .basename(file, ".svelte")
    .split(/[^a-z0-9]+/iu)
    .filter((part) => part !== "")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join("") || "Component";

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
  /** Declared inside a function: a factory's call, named after its arguments, wins over it. */
  readonly local: boolean;
}

/** A call to an atom factory, such as `todoAtom(id)`: its callee is wrapped to name the result. */
interface FactoryCall {
  readonly calleeStart: number;
  readonly calleeEnd: number;
  readonly name: string;
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

// What a state atom can be piped through and stay one: what is written to it is still what it
// reads. `Atom.map` and the like write through to their source, so their value can't be written
// back.
const stateKeeping = new Set([
  "keepAlive",
  "autoDispose",
  "setIdleTTL",
  "setLazy",
  "withEquality",
  "withLabel",
  "serializable",
  "withServerValue",
  "withServerValueInitial",
]);

/** Whether `Atom.keepAlive`, `Atom.setIdleTTL(...)` or the like: one of `stateKeeping`. */
const keepsState = (argument: Node): boolean => {
  const node = unwrap(argument);
  const callee =
    node.type === "CallExpression" ? unwrap(node.callee as Node) : node;
  return (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    (callee.object as Node).type === "Identifier" &&
    (callee.object as Node).name === "Atom" &&
    stateKeeping.has(String((callee.property as Node).name))
  );
};

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
    return (
      object.type === "CallExpression" &&
      isState(object) &&
      (node.arguments as Node[]).every(keepsState)
    );
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
      local: !topLevel,
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

// A factory is named for what it makes: `todoAtom`, `makeSessionAtom`. `Atom` itself, hooks
// (`useAtom`) and checks (`isAtom`) never return a new atom.
const factoryName = /^(?!use[A-Z]|is[A-Z])[\w$]+Atom$/u;

/**
 * The calls to atom factories in a program, offset by `base`: calls to a function whose name ends
 * in `Atom`. At run time each result that is an atom is named after the call and its arguments,
 * as `mapDraftAtom({"doc":1})`, so a cache that makes a new atom for a key it has seen shows it.
 */
const factoryCalls = (program: Node, base: number): FactoryCall[] =>
  descendants(program).flatMap((node) => {
    const callee =
      node.type === "CallExpression" ? (node.callee as Node) : undefined;
    return callee?.type === "Identifier" &&
      factoryName.test(String(callee.name))
      ? [
          {
            calleeEnd: base + callee.end,
            calleeStart: base + callee.start,
            name: String(callee.name),
          },
        ]
      : [];
  });

const parse = (code: string): Node =>
  parser.parse(code, {
    ecmaVersion: "latest",
    sourceType: "module",
  }) as unknown as Node;

// Svelte's own pattern for finding scripts to preprocess (svelte/src/compiler/preprocess).
const scriptPattern =
  /<!--[^]*?-->|<script(?<attributes>(?:\s+[^=>'"/\s]+=(?:"[^"]*"|'[^']*'|[^>\s]+)|\s+[^=>'"/\s]+)*\s*)(?:\/>|>(?<code>[\S\s]*?)<\/script>)/gu;

/** Text blanked out, keeping its offsets (an astral character is two UTF-16 units) and lines. */
const blank = (text: string): string =>
  text.replaceAll(/[^\n]/gu, (character) => " ".repeat(character.length));

/** The component with each script and style's content blanked out, so only its markup is left. */
const markupOf = (
  source: string,
  matches: readonly RegExpExecArray[]
): string => {
  let markup = source;
  for (const match of matches) {
    const { code } = match.groups ?? {};
    if (code !== undefined) {
      const from =
        match.index + match[0].length - "</script>".length - code.length;
      markup =
        markup.slice(0, from) + blank(code) + markup.slice(from + code.length);
    }
  }
  return markup.replaceAll(
    /(?<open><style(?:\s[^>]*)?>)(?<css>[^]*?)<\/style>/gu,
    (_, open: string, css: string) => `${open}${blank(css)}</style>`
  );
};

/**
 * Where the component's own scripts (its instance and module scripts) start, as Svelte's parser
 * sees them: a script nested in the markup (in an element, a block or <svelte:head>) is page HTML.
 * Takes the blanked markup, so a script or style that needs a preprocessor doesn't matter.
 * `undefined` if the markup doesn't parse either.
 */
const topLevel = (markup: string): Set<number> | undefined => {
  try {
    const ast = parseComponent(markup, { modern: true });
    return new Set(
      [ast.instance?.start, ast.module?.start].filter(
        (start) => start !== undefined
      )
    );
  } catch {
    return undefined;
  }
};

/** The scripts of a component: where each one's code starts, the code, and if it is the module script. */
const scripts = (source: string) => {
  const found: { start: number; code: string; module: boolean }[] = [];
  const matches = [...source.matchAll(scriptPattern)];
  const markup = markupOf(source, matches);
  const top = topLevel(markup);
  // The fallback when the markup doesn't parse. HTML comments are matched too, and scripts and
  // styles are blanked, so neither kind of comment that mentions <svelte:head> starts a head.
  const heads = [
    ...markup.matchAll(/<!--[^]*?-->|<svelte:head\b[^]*?<\/svelte:head>/gu),
  ]
    .filter((m) => m[0].startsWith("<svelte:head"))
    .map((m) => [m.index, m.index + m[0].length] as const);
  for (const match of matches) {
    const { attributes, code } = match.groups ?? {};
    if (attributes === undefined || code === undefined) {
      continue;
    }
    if (
      top
        ? !top.has(match.index)
        : heads.some(([from, to]) => match.index > from && match.index < to)
    ) {
      continue;
    }
    found.push({
      code,
      module: /\bmodule\b/u.test(attributes),
      start: match.index + "<script".length + attributes.length + 1,
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

/**
 * Where a file is, as the dev server addresses it, with forward slashes: relative to `root`, or
 * outside it by its full path after `/@fs/`.
 */
const address = (file: string, root: string): string => {
  const relative = path.relative(root, file);
  const inside = !relative.startsWith("..") && !path.isAbsolute(relative);
  const slashed = (inside ? relative : file).replaceAll("\\", "/");
  return inside ? `/${slashed}` : `/@fs/${slashed.replace(/^\//u, "")}`;
};

/** Wraps each labelled declaration's call in `label(...)`, and each factory's callee in `call(...)`. */
const wrap = (
  output: MagicString,
  code: string,
  found: readonly Site[],
  calls: readonly FactoryCall[],
  where: (offset: number) => string
): void => {
  for (const site of found) {
    const options = {
      ...(site.family ? { family: true } : {}),
      // The declaration's source, hashed: an edit to it means the old value no longer applies.
      ...(site.keep ? { keep: hash(code.slice(site.start, site.end)) } : {}),
      ...(site.local ? { local: true } : {}),
    };
    const args = [
      JSON.stringify(site.name),
      JSON.stringify(where(site.at)),
      ...(Object.keys(options).length > 0 ? [JSON.stringify(options)] : []),
    ];
    output.appendLeft(site.start, `${labelBinding}(`);
    output.appendRight(site.end, `, ${args.join(", ")})`);
  }
  // After the sites: a declaration made by a factory's call wraps the call, callee and all.
  for (const factory of calls) {
    output.appendLeft(factory.calleeStart, `${callBinding}(`);
    output.appendRight(
      factory.calleeEnd,
      `, ${JSON.stringify(factory.name)}, ${JSON.stringify(where(factory.calleeStart))})`
    );
  }
};

/**
 * Labels the atoms declared in a module or a component's scripts, and names the component at the
 * top of its instance script, for the inspector scopes its hooks report to. Returns the new code and
 * its source map, or `undefined` when there is nothing to do or the code doesn't parse (a component
 * whose script needs a preprocessor, say), which leaves the file as it is.
 */
export const labelAtoms = (
  code: string,
  file: string,
  root: string,
  { keep = true }: { readonly keep?: boolean } = {}
):
  | { code: string; map: ReturnType<MagicString["generateMap"]> }
  | undefined => {
  const svelte = file.endsWith(".svelte");
  const defaultName = path.basename(file).replace(/\..*$/u, "");
  let found: Site[] = [];
  let calls: FactoryCall[] = [];
  // Where the import of `label` goes.
  let importAt = 0;
  // Where a component's instance script starts, to name the component there.
  let instanceAt: number | undefined;
  try {
    if (svelte) {
      const blocks = scripts(code).map((block) => {
        const program = parse(block.code);
        return {
          ...block,
          calls: factoryCalls(program, block.start),
          sites: sites(program, block.start, defaultName, block.module),
        };
      });
      found = blocks.flatMap((block) => block.sites);
      calls = blocks.flatMap((block) => block.calls);
      // The module script if it uses the label module, as the instance script can see its imports
      // but not the other way round.
      const uses = (block: (typeof blocks)[number]) =>
        block.sites.length > 0 || block.calls.length > 0;
      const host =
        blocks.find((block) => block.module && uses(block)) ??
        blocks.find(uses);
      importAt = host?.start ?? 0;
      instanceAt = blocks.find((block) => !block.module)?.start;
    } else {
      const program = parse(code);
      found = sites(program, 0, defaultName, true);
      calls = factoryCalls(program, 0);
      importAt = code.startsWith("#!") ? code.indexOf("\n") + 1 : 0;
    }
  } catch {
    return undefined;
  }
  if (found.length === 0 && calls.length === 0 && instanceAt === undefined) {
    return undefined;
  }

  if (!keep) {
    // A build has no hot reloads to keep values across.
    found = found.map((site) => ({ ...site, keep: false }));
  }
  const at = locate(code);
  const place = address(file, root);
  const output = new MagicString(code);
  const specifiers = [
    ...(found.length > 0 ? [`label as ${labelBinding}`] : []),
    ...(calls.length > 0 ? [`call as ${callBinding}`] : []),
  ];
  if (specifiers.length > 0) {
    output.appendLeft(
      importAt,
      `import { ${specifiers.join(", ")} } from ${JSON.stringify(labelModule)};`
    );
  }
  if (instanceAt !== undefined) {
    // Before anything else in the script, so the component's hooks see its name.
    output.appendLeft(
      instanceAt,
      `import { component as ${componentBinding} } from ${JSON.stringify(labelModule)};${componentBinding}(${JSON.stringify(componentName(file))}, ${JSON.stringify(place)});`
    );
  }
  wrap(output, code, found, calls, (offset) => `${place}:${at(offset)}`);
  return {
    code: output.toString(),
    map: output.generateMap({
      hires: "boundary",
      includeContent: true,
      source: file,
    }),
  };
};
