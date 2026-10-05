import { readdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

import { Marked } from "marked";
import type { Tokens } from "marked";
import { format } from "oxfmt";
import ts from "typescript";
import type { Plugin } from "vite";

import { pages } from "../src/lib/docs/nav.ts";
import { headingId } from "./heading-links.ts";
import { highlight } from "./highlight.ts";

/**
 * The API reference, read from the library's source at build time the way Effect's `docgen` reads
 * Effect's: every export of a top-level `src/*.ts` module (the files `scripts/check-docs.ts`
 * checks), with its JSDoc, and a signature printed by the type checker for values.
 */

/** An example: a fenced code block, titled by Effect's `**Example** (Title)` label. */
export interface ApiExample {
  readonly code: string;
  readonly title?: string | undefined;
}

/** The guide page that teaches an export: its address (maybe with a section) and its title. */
export interface ApiGuide {
  readonly href: string;
  readonly title: string;
}

/** An exported name and its JSDoc. Text fields are Markdown; `signature` is TypeScript. */
export interface ApiExport {
  readonly category: string;
  readonly description: string;
  readonly examples: readonly ApiExample[];
  readonly guide?: ApiGuide | undefined;
  /** For `export * from`: the page of the module it re-exports. */
  readonly module?: string | undefined;
  readonly name: string;
  readonly signature: string;
  readonly since: string;
  readonly stability?: string | undefined;
}

/** A module of another package that the library re-exports, and the address of its source. */
export interface ApiReExportedModule {
  readonly guide?: ApiGuide | undefined;
  readonly name: string;
  readonly source: string;
}

/**
 * One `export { A, B } from "package"` statement. Its JSDoc describes the whole group, so the
 * reference lists the names once instead of repeating the description for each.
 */
export interface ApiReExports {
  readonly category: string;
  readonly description: string;
  readonly from: string;
  readonly modules: readonly ApiReExportedModule[];
  readonly since: string;
  readonly stability?: string | undefined;
}

/** How an app imports a module: the entry point, and the namespace if it is not imported by name. */
export interface ApiImport {
  readonly from: string;
  readonly namespace?: string | undefined;
}

/** A `package.json` export: what an app imports, the module's page, and its first sentence. */
export interface ApiEntryPoint {
  readonly from: string;
  readonly href: string;
  readonly summary: string;
}

/** A source module and its exports, sorted like docgen sorts them: by category, then by name. */
export interface ApiModule {
  readonly description: string;
  /** On the index only: every entry point of the package. */
  readonly entryPoints?: readonly ApiEntryPoint[] | undefined;
  readonly exports: readonly ApiExport[];
  readonly file: string;
  readonly href: string;
  readonly import: ApiImport;
  readonly name: string;
  readonly reExports: readonly ApiReExports[];
}

/** A JSDoc comment: the text before the first tag, and the text of each tag. */
interface Doc {
  readonly description: string;
  readonly tags: ReadonlyMap<string, readonly string[]>;
}

/** The description or a tag, while a comment is being read. */
interface DocBlock {
  readonly lines: string[];
  readonly tag: string | undefined;
}

const packageName = "effect-atom-svelte";

/**
 * The guide page that teaches each export, by name. An export missing here gets no guide link;
 * a page missing from the sidebar, or a section missing from its page, fails the build.
 */
const guides: Readonly<Record<string, string>> = {
  AsyncResult: "/async-atoms#asyncresult",
  Atom: "/first-atom",
  AtomHttpApi: "/http",
  AtomInput: "/reading-and-writing#following-a-different-atom",
  AtomRef: "/refs",
  AtomRegistry: "/installation#add-a-registry",
  AtomRpc: "/rpc",
  AtomState: "/reading-and-writing",
  AtomValue: "/reading-and-writing",
  CaughtError: "/sveltekit#errors-in-boundaries",
  EffectErrorBody: "/sveltekit#errors-in-boundaries",
  Hooks: "/reading-and-writing",
  Hydration: "/hydration",
  HydrationBoundary: "/hydration#hydrationboundary",
  ProvideExistingRegistry: "/installation#registry-options",
  ProvideNewRegistry: "/installation#registry-options",
  ProvideRegistryOptions: "/installation#registry-options",
  RegistryContext: "/installation#add-a-registry",
  RegistryOptions: "/installation#registry-options",
  RegistryProvider: "/installation#add-a-registry",
  ResultOptions: "/suspense#awaiting-in-the-script",
  ScopedAtom: "/scoped-atoms",
  SuspenseOptions: "/suspense",
  TypeId: "/scoped-atoms",
  WriteMode: "/mutations",
  WriteOptions: "/mutations",
  getRegistry: "/cookbook",
  handleClientError: "/sveltekit#errors-in-boundaries",
  handleServerError: "/sveltekit#errors-in-boundaries",
  make: "/scoped-atoms",
  provideRegistry: "/installation#registry-options",
  useAtom: "/reading-and-writing#reading-and-writing",
  useAtomMount: "/lifetimes#holding-an-atom-from-a-component",
  useAtomRef: "/refs#reading-a-ref-in-a-component",
  useAtomRefProp: "/refs#reading-a-ref-in-a-component",
  useAtomRefPropValue: "/refs#reading-a-ref-in-a-component",
  useAtomRefresh: "/async-atoms#running-it-again",
  useAtomResult: "/suspense#awaiting-in-the-script",
  useAtomSet: "/reading-and-writing#writing",
  useAtomSubscribe: "/reading-and-writing#running-code-on-every-change",
  useAtomSuspense: "/suspense",
  useAtomValue: "/reading-and-writing#reading",
};

/** The guide for an export, titled from the sidebar. */
const guideOf = (name: string): ApiGuide | undefined => {
  const href = guides[name];
  if (href === undefined) {
    return undefined;
  }
  const [pathname = ""] = href.split("#");
  const page = pages.find((entry) => entry.href === pathname);
  if (!page) {
    throw new Error(
      `The guide for ${name}, ${href}, is not a page in src/lib/docs/nav.ts`
    );
  }
  return { href, title: page.title };
};

/** A Markdown description's first sentence, for a summary. */
const firstSentence = (text: string) =>
  /^[\s\S]*?\.(?=\s|$)/u.exec(text.trim())?.[0] ?? text.trim();

/** `Hooks.svelte.ts` is the module `Hooks`. */
const moduleName = (file: string) => file.replace(/(?:\.svelte)?\.ts$/u, "");

/** The page for a module: `/reference/Hooks`, and `/reference` for the index. */
const moduleHref = (file: string) => {
  const name = moduleName(file);
  return name === "index" ? "/reference" : `/reference/${name}`;
};

const parseDoc = (comment: string): Doc => {
  const blocks: DocBlock[] = [{ lines: [], tag: undefined }];
  const body = comment.replace(/^\/\*\*/u, "").replace(/\*\/$/u, "");
  for (const raw of body.split("\n")) {
    const line = raw.replace(/^\s*\* ?/u, "").trimEnd();
    const tag = /^@(?<name>\w+) ?(?<rest>.*)$/u.exec(line)?.groups;
    if (tag) {
      blocks.push({ lines: [tag.rest ?? ""], tag: tag.name });
    } else {
      blocks.at(-1)?.lines.push(line);
    }
  }
  const tags = new Map<string, string[]>();
  for (const { lines, tag } of blocks) {
    if (tag !== undefined) {
      tags.set(tag, [...(tags.get(tag) ?? []), lines.join("\n").trim()]);
    }
  }
  return { description: blocks[0]?.lines.join("\n").trim() ?? "", tags };
};

const exampleLabel = /^\*\*Example\*\*(?: \((?<title>.+)\))?$/u;

/**
 * Takes Effect's examples out of a description: a `**Example** (Title)` line, then one fenced
 * block. The page shows them after the signature, where docgen shows `@example` tags.
 */
const extractExamples = (description: string, where: string) => {
  const kept: string[] = [];
  const examples: ApiExample[] = [];
  const lines = description.split("\n");
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    const label = exampleLabel.exec(line);
    if (label) {
      let start = index + 1;
      while (lines[start] === "") {
        start += 1;
      }
      const end = lines.findIndex(
        (other, at) => at > start && other.startsWith("```")
      );
      if (!lines[start]?.startsWith("```") || end === -1) {
        throw new Error(`${where}: ${line} needs a fenced code block after it`);
      }
      examples.push({
        code: lines.slice(start, end + 1).join("\n"),
        title: label.groups?.title,
      });
      index = end + 1;
    } else {
      kept.push(line);
      index += 1;
    }
  }
  return { description: kept.join("\n").trim(), examples };
};

/** The JSDoc comment closest before a node, which is the one TypeScript attaches to it. */
const docOf = (node: ts.Node, source: ts.SourceFile): Doc | undefined => {
  const comment = ts
    .getLeadingCommentRanges(source.text, node.getFullStart())
    ?.map((range) => source.text.slice(range.pos, range.end))
    .findLast((text) => text.startsWith("/**"));
  return comment === undefined ? undefined : parseDoc(comment);
};

/** The comment at the very top of a module, which describes the module. */
const moduleDoc = (source: ts.SourceFile): Doc | undefined => {
  const [range] = ts.getLeadingCommentRanges(source.text, 0) ?? [];
  const text = range && source.text.slice(range.pos, range.end);
  return text?.startsWith("/**") ? parseDoc(text) : undefined;
};

const isExported = (node: ts.Node) =>
  ts.canHaveModifiers(node) &&
  (ts.getModifiers(node) ?? []).some(
    (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
  );

// docgen's flags: no truncation, aliases as written (`Atom.Atom<A>`), arrow style for functions.
// oxlint-disable eslint/no-bitwise -- TypeScript's format flags are a bit set
const typeFlags =
  ts.TypeFormatFlags.NoTruncation |
  ts.TypeFormatFlags.WriteArrayAsGenericType |
  ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope |
  ts.TypeFormatFlags.NoTypeReduction |
  ts.TypeFormatFlags.AllowUniqueESSymbolType |
  ts.TypeFormatFlags.WriteArrowStyleSignature;
// oxlint-enable eslint/no-bitwise

/** A function's declaration without its body, as a `.d.ts` would have it. */
const declaration = (node: ts.FunctionDeclaration, source: ts.SourceFile) => {
  const end = node.body?.getStart(source) ?? node.getEnd();
  const text = source.text.slice(node.getStart(source), end).trim();
  return text.replace(/;$/u, "").replace(/^export /u, "export declare ");
};

/** A component's description (its `@component` comment) and its props interface. */
const readComponent = async (file: string) => {
  const text = await readFile(file, "utf-8");
  const componentComment = /<!--\s*@component\s(?<body>[\s\S]*?)-->/u;
  const comment = componentComment.exec(text)?.groups?.body;
  // Looked for after the comment, whose examples have script tags of their own.
  const script =
    /<script lang="ts">(?<body>[\s\S]*?)<\/script>/u.exec(
      text.replace(componentComment, "")
    )?.groups?.body ?? "";
  const source = ts.createSourceFile(file, script, ts.ScriptTarget.Latest);
  // An interface, or a type alias when the props are a union, as RegistryProvider's are.
  const props = source.statements.find(
    (
      statement
    ): statement is ts.InterfaceDeclaration | ts.TypeAliasDeclaration =>
      (ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement)) &&
      statement.name.text === "Props"
  );
  if (comment === undefined || props === undefined) {
    throw new Error(
      `${file}: a component needs an @component comment and a Props type`
    );
  }
  // The comment is indented in the file; its examples' code keeps its own indentation.
  const lines = comment.split(/\r?\n/u);
  const indent = Math.min(
    ...lines
      .filter((line) => line.trim() !== "")
      .map((line) => line.length - line.trimStart().length)
  );
  return {
    description: lines
      .map((line) => line.slice(indent).trimEnd())
      .join("\n")
      .trim(),
    signature: props.getText(source),
  };
};

/** `package.json` `exports` by source file: `SvelteKit.ts` is `effect-atom-svelte/sveltekit`. */
const readEntryPoints = async (packageDir: string) => {
  const manifest = JSON.parse(
    await readFile(path.join(packageDir, "package.json"), "utf-8")
  ) as { exports: Record<string, { readonly default: string }> };
  return new Map(
    Object.entries(manifest.exports).map(([subpath, { default: target }]) => [
      path.basename(target).replace(/\.js$/u, ".ts"),
      path.posix.join(packageName, subpath),
    ])
  );
};

/** The version of Effect the library is built against, for links to Effect's source. */
const readEffectVersion = async (packageDir: string) => {
  const manifest = createRequire(path.join(packageDir, "package.json")).resolve(
    "effect/package.json"
  );
  const { version } = JSON.parse(await readFile(manifest, "utf-8")) as {
    readonly version: string;
  };
  return version;
};

/** Where an app imports `file` from: its own entry point, or the index that re-exports it. */
const importOf = (
  file: string,
  entryPoints: ReadonlyMap<string, string>,
  index: ts.SourceFile
): ApiImport => {
  const entry = entryPoints.get(file);
  if (entry !== undefined) {
    return { from: entry };
  }
  for (const statement of index.statements) {
    const specifier =
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
        ? statement.moduleSpecifier.text
        : undefined;
    if (ts.isExportDeclaration(statement) && specifier === `./${file}`) {
      const clause = statement.exportClause;
      if (clause === undefined) {
        return { from: packageName };
      }
      if (ts.isNamespaceExport(clause)) {
        return { from: packageName, namespace: clause.name.text };
      }
    }
  }
  throw new Error(
    `${file} is neither an entry point nor re-exported by index.ts`
  );
};

const byIndexThenName = (a: ApiModule, b: ApiModule) => {
  if (a.name === "index" || b.name === "index") {
    return Number(b.name === "index") - Number(a.name === "index");
  }
  return a.name.localeCompare(b.name);
};

/** Reads every export of the library's top-level modules, with its docs and signature. */
export const readApiReference = async (
  packageDir: string
): Promise<readonly ApiModule[]> => {
  const src = path.join(packageDir, "src");
  const entries = await readdir(src);
  const files = entries.filter((name) => name.endsWith(".ts"));
  const config = ts.getParsedCommandLineOfConfigFile(
    path.join(packageDir, "tsconfig.json"),
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        throw new Error(
          ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
        );
      },
    }
  );
  const program = ts.createProgram(
    files.map((file) => path.join(src, file)),
    config?.options ?? {}
  );
  const checker = program.getTypeChecker();
  const sourceOf = (file: string) => {
    const source = program.getSourceFile(path.join(src, file));
    if (!source) {
      throw new Error(`TypeScript did not load ${file}`);
    }
    return source;
  };
  const entryPoints = await readEntryPoints(packageDir);
  const index = sourceOf("index.ts");
  const effectVersion = await readEffectVersion(packageDir);

  /** Effect's source for a module re-exported from `effect/<path>`, at the installed version. */
  const sourceUrl = (specifier: string, name: string) => {
    const subpath = /^effect\/(?<path>.+)$/u.exec(specifier)?.groups?.path;
    if (subpath === undefined) {
      throw new Error(
        `The API reference can only link re-exports from effect/*, not from ${specifier}`
      );
    }
    return `https://github.com/Effect-TS/effect/blob/effect%40${effectVersion}/packages/effect/src/${subpath}/${name}.ts`;
  };

  const readModule = async (file: string): Promise<ApiModule> => {
    const source = sourceOf(file);
    const exports: ApiExport[] = [];
    const reExports: ApiReExports[] = [];
    const seen = new Set<string>();

    const tagsOf = (node: ts.Node, name: string) => {
      const doc = docOf(node, source);
      const tag = (key: string) => doc?.tags.get(key)?.[0];
      const since = tag("since");
      const category = tag("category");
      if (since === undefined || category === undefined) {
        throw new Error(`${file}: export ${name} needs @since and @category`);
      }
      return { category, doc, since, stability: tag("stability") };
    };

    const add = (
      node: ts.Node,
      name: string,
      signature: string,
      extra: Partial<ApiExport> = {}
    ) => {
      const { category, doc, since, stability } = tagsOf(node, name);
      const text = extractExamples(
        extra.description ?? doc?.description ?? "",
        `${file}: ${name}`
      );
      // docgen's rule: an `@example` tag that is not a fenced block is TypeScript.
      const tagged = (doc?.tags.get("example") ?? []).map((example) => ({
        code: example.startsWith("```")
          ? example
          : `\`\`\`ts\n${example}\n\`\`\``,
      }));
      exports.push({
        category,
        guide: guideOf(name),
        name,
        signature,
        since,
        stability,
        ...extra,
        description: text.description,
        examples: [...text.examples, ...tagged],
      });
    };

    // Overloads share the first one's doc, and the implementation's signature is not public.
    const addFunction = (node: ts.FunctionDeclaration, name: string) => {
      if (seen.has(name)) {
        return;
      }
      seen.add(name);
      const all = source.statements.filter(
        (other): other is ts.FunctionDeclaration =>
          ts.isFunctionDeclaration(other) && other.name?.text === name
      );
      const overloads = all.filter((other) => other.body === undefined);
      const shown = overloads.length > 0 ? overloads : all;
      add(
        node,
        name,
        shown.map((other) => declaration(other, source)).join(";\n")
      );
    };

    const addVariables = (node: ts.VariableStatement) => {
      for (const variable of node.declarationList.declarations) {
        const name = variable.name.getText(source);
        const type = checker.typeToString(
          checker.getTypeAtLocation(variable),
          variable,
          typeFlags
        );
        add(node, name, `export declare const ${name}: ${type}`);
      }
    };

    // Another package's modules, re-exported by name, are listed together under one description.
    const addPackageReExports = (
      node: ts.ExportDeclaration,
      clause: ts.NamedExports,
      specifier: string
    ) => {
      const { category, doc, since, stability } = tagsOf(
        node,
        clause.elements.map((element) => element.name.text).join(", ")
      );
      reExports.push({
        category,
        description: doc?.description ?? "",
        from: specifier,
        modules: clause.elements.map((element) => ({
          guide: guideOf(element.name.text),
          name: element.name.text,
          source: sourceUrl(
            specifier,
            element.propertyName?.text ?? element.name.text
          ),
        })),
        since,
        stability,
      });
    };

    const addReExports = async (node: ts.ExportDeclaration) => {
      const specifier =
        node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)
          ? node.moduleSpecifier.text
          : "";
      const local = specifier.startsWith("./") ? specifier.slice(2) : undefined;
      const clause = node.exportClause;
      if (clause === undefined || ts.isNamespaceExport(clause)) {
        if (local === undefined) {
          throw new Error(`${file}: export * from a package is not supported`);
        }
        add(
          node,
          clause?.name.text ?? moduleName(local),
          node.getText(source),
          {
            module: moduleHref(local),
          }
        );
        return;
      }
      if (local === undefined) {
        addPackageReExports(node, clause, specifier);
        return;
      }
      for (const element of clause.elements) {
        const name = element.name.text;
        const original = element.propertyName?.text ?? name;
        if (local.endsWith(".svelte") && original === "default") {
          // oxlint-disable-next-line eslint/no-await-in-loop -- one file per component, in order
          const component = await readComponent(path.join(src, local));
          add(node, name, component.signature, {
            description: component.description,
          });
        } else {
          const alias = original === name ? name : `${original} as ${name}`;
          add(node, name, `export { ${alias} } from "${specifier}"`);
        }
      }
    };

    for (const statement of source.statements) {
      if (ts.isExportDeclaration(statement)) {
        // oxlint-disable-next-line eslint/no-await-in-loop -- exports are read in source order
        await addReExports(statement);
      } else if (!isExported(statement)) {
        continue;
      } else if (
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement)
      ) {
        add(statement, statement.name.text, statement.getText(source));
      } else if (ts.isFunctionDeclaration(statement) && statement.name) {
        addFunction(statement, statement.name.text);
      } else if (ts.isVariableStatement(statement)) {
        addVariables(statement);
      } else {
        throw new Error(
          `${file}: the API reference cannot read ${ts.SyntaxKind[statement.kind]} exports yet`
        );
      }
    }

    return {
      description: moduleDoc(source)?.description ?? "",
      exports: exports.toSorted(
        (a, b) =>
          a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
      ),
      file,
      href: moduleHref(file),
      import: importOf(file, entryPoints, index),
      name: moduleName(file),
      reExports,
    };
  };

  const modules = await Promise.all(files.map(readModule));
  // The index lists every entry point, each summed up by its module's first sentence.
  const entryPointList = [...entryPoints].map(([file, from]) => ({
    from,
    href: moduleHref(file),
    summary: firstSentence(
      modules.find((module) => module.file === file)?.description ?? ""
    ),
  }));
  return modules
    .map((module) =>
      module.name === "index"
        ? { ...module, entryPoints: entryPointList }
        : module
    )
    .toSorted(byIndexThenName);
};

/** An export as a page shows it: Markdown rendered and code highlighted. */
export interface ApiExportHtml extends Omit<
  ApiExport,
  "description" | "examples" | "signature"
> {
  readonly description: string;
  readonly examples: readonly {
    readonly html: string;
    readonly title?: string | undefined;
  }[];
  readonly signature: string;
}

/** A group of re-exports as a page shows it, its description rendered. */
export interface ApiReExportsHtml extends Omit<ApiReExports, "description"> {
  readonly description: string;
}

/** A module as a page shows it, its exports grouped by category. */
export interface ApiModuleHtml extends Omit<
  ApiModule,
  "description" | "exports" | "reExports"
> {
  readonly categories: readonly {
    readonly exports: readonly ApiExportHtml[];
    readonly title: string;
  }[];
  readonly description: string;
  readonly reExports: readonly ApiReExportsHtml[];
}

/** A code token with its highlighted HTML, added before rendering. */
interface HighlightedCode extends Tokens.Code {
  html?: string;
}

const markdown = new Marked({
  async: true,
  renderer: {
    code: (token: HighlightedCode) => token.html ?? "",
  },
  async walkTokens(token) {
    if (token.type === "code") {
      const code = token as HighlightedCode;
      code.html = await highlight(code.text, code.lang || "ts");
    }
  },
});

const renderMarkdown = (text: string) => markdown.parse(text);
const renderInline = (text: string) => markdown.parseInline(text);

/** Signatures are wrapped to fit the code frame, as oxfmt formats the library itself. */
const renderSignature = async (signature: string) => {
  const formatted = await format("signature.ts", signature, { printWidth: 80 });
  if (formatted.errors.length > 0) {
    throw new Error(`Cannot format the signature:\n${signature}`);
  }
  return highlight(formatted.code.trimEnd(), "ts");
};

const renderExport = async (entry: ApiExport): Promise<ApiExportHtml> => ({
  ...entry,
  description: await renderMarkdown(entry.description),
  examples: await Promise.all(
    entry.examples.map(async ({ code, title }) => ({
      html: await renderMarkdown(code),
      title,
    }))
  ),
  signature: await renderSignature(entry.signature),
});

/** Renders a module's Markdown and highlights its code. */
const renderApiModule = async (module: ApiModule): Promise<ApiModuleHtml> => {
  const exports = await Promise.all(module.exports.map(renderExport));
  const titles = [...new Set(exports.map((entry) => entry.category))];
  return {
    ...module,
    categories: titles.map((title) => ({
      exports: exports.filter((entry) => entry.category === title),
      title,
    })),
    description: await renderMarkdown(module.description),
    entryPoints:
      module.entryPoints &&
      (await Promise.all(
        module.entryPoints.map(async (entry) => ({
          ...entry,
          summary: await renderInline(entry.summary),
        }))
      )),
    reExports: await Promise.all(
      module.reExports.map(async (group) => ({
        ...group,
        description: await renderMarkdown(group.description),
      }))
    ),
  };
};

/** Fails when a guide link names a section its page doesn't have. */
const checkGuideSections = async (
  modules: readonly ApiModule[],
  routes: string
) => {
  const guidesUsed = modules.flatMap((module) => [
    ...module.exports.map((entry) => entry.guide),
    ...module.reExports.flatMap((group) =>
      group.modules.map((entry) => entry.guide)
    ),
  ]);
  const sections = new Set(
    guidesUsed.flatMap((guide) =>
      guide?.href.includes("#") ? [guide.href] : []
    )
  );
  for (const href of sections) {
    const [pathname = "", section] = href.split("#");
    // oxlint-disable-next-line eslint/no-await-in-loop -- a handful of small files
    const text = await readFile(
      path.join(routes, pathname, "+page.md"),
      "utf-8"
    );
    const ids = text
      .split(/\r?\n/u)
      .flatMap(
        (line) => /^#{2,3} (?<title>.+)$/u.exec(line)?.groups?.title ?? []
      )
      .map(headingId);
    if (!ids.includes(section ?? "")) {
      throw new Error(
        `The API reference links to ${href}, but ${pathname} has no such section: update the guides in vite/api-reference.ts`
      );
    }
  }
};

const id = "virtual:api-reference";
const resolvedId = `\0${id}`;

/**
 * `import { modules } from "virtual:api-reference"` gives the library's API reference, read from
 * its source when the docs are built, so it is never out of date.
 */
export const apiReference = (): Plugin => {
  let packageDir = "";
  let routes = "";
  return {
    configResolved(config) {
      packageDir = path.resolve(
        config.root,
        "../../packages/effect-atom-svelte"
      );
      routes = path.resolve(config.root, "src/routes");
    },
    async load(loading) {
      if (loading !== resolvedId) {
        return;
      }
      const src = path.join(packageDir, "src");
      // Any source file can change a printed type, not only the modules' own.
      for (const file of await readdir(src, { recursive: true })) {
        this.addWatchFile(path.join(src, file));
      }
      const modules = await readApiReference(packageDir);
      const missing = modules.filter(
        (module) => !pages.some((page) => page.href === module.href)
      );
      if (missing.length > 0) {
        throw new Error(
          `Add the API reference for ${missing.map((module) => module.file).join(", ")} to src/lib/docs/nav.ts`
        );
      }
      await checkGuideSections(modules, routes);
      const rendered = await Promise.all(modules.map(renderApiModule));
      return `export const modules = ${JSON.stringify(rendered)};`;
    },
    name: "api-reference",
    resolveId(source) {
      return source === id ? resolvedId : undefined;
    },
  };
};
