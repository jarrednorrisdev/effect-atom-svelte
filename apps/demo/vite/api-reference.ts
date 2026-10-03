import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { Marked } from "marked";
import type { Tokens } from "marked";
import { format } from "oxfmt";
import ts from "typescript";
import type { Plugin } from "vite";

import { pages } from "../src/lib/docs/nav.ts";
import { highlight } from "./highlight.ts";

/**
 * The API reference, read from the library's source at build time the way Effect's `docgen` reads
 * Effect's: every export of a top-level `src/*.ts` module (the files `scripts/check-docs.ts`
 * checks), with its JSDoc, and a signature printed by the type checker for values.
 */

/** An exported name and its JSDoc. Text fields are Markdown; `signature` is TypeScript. */
export interface ApiExport {
  readonly category: string;
  readonly description: string;
  readonly examples: readonly string[];
  /** For `export * from`: the page of the module it re-exports. */
  readonly module?: string | undefined;
  readonly name: string;
  readonly signature: string;
  readonly since: string;
  readonly stability?: string | undefined;
}

/** How an app imports a module: the entry point, and the namespace if it is not imported by name. */
export interface ApiImport {
  readonly from: string;
  readonly namespace?: string | undefined;
}

/** A source module and its exports, sorted like docgen sorts them: by category, then by name. */
export interface ApiModule {
  readonly description: string;
  readonly exports: readonly ApiExport[];
  readonly file: string;
  readonly href: string;
  readonly import: ApiImport;
  readonly name: string;
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
  const comment = /<!--\s*@component\s(?<body>[\s\S]*?)-->/u.exec(text)?.groups
    ?.body;
  const script =
    /<script lang="ts">(?<body>[\s\S]*?)<\/script>/u.exec(text)?.groups?.body ??
    "";
  const source = ts.createSourceFile(file, script, ts.ScriptTarget.Latest);
  const props = source.statements.find(
    (statement): statement is ts.InterfaceDeclaration =>
      ts.isInterfaceDeclaration(statement) && statement.name.text === "Props"
  );
  if (comment === undefined || props === undefined) {
    throw new Error(
      `${file}: a component needs an @component comment and a Props interface`
    );
  }
  return {
    description: comment
      .split("\n")
      .map((line) => line.trim())
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

  const readModule = async (file: string): Promise<ApiModule> => {
    const source = sourceOf(file);
    const exports: ApiExport[] = [];
    const seen = new Set<string>();

    const add = (
      node: ts.Node,
      name: string,
      signature: string,
      extra: Partial<ApiExport> = {}
    ) => {
      const doc = docOf(node, source);
      const tag = (key: string) => doc?.tags.get(key)?.[0];
      const since = tag("since");
      const category = tag("category");
      if (since === undefined || category === undefined) {
        throw new Error(`${file}: export ${name} needs @since and @category`);
      }
      exports.push({
        category,
        description: doc?.description ?? "",
        examples: doc?.tags.get("example") ?? [],
        name,
        signature,
        since,
        stability: tag("stability"),
        ...extra,
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
      for (const element of clause.elements) {
        const name = element.name.text;
        const original = element.propertyName?.text ?? name;
        if (local?.endsWith(".svelte") && original === "default") {
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
    };
  };

  const modules = await Promise.all(files.map(readModule));
  return modules.toSorted(byIndexThenName);
};

/** An export as a page shows it: Markdown rendered and code highlighted. */
export interface ApiExportHtml extends Omit<
  ApiExport,
  "description" | "examples" | "signature"
> {
  readonly description: string;
  readonly examples: readonly string[];
  readonly signature: string;
}

/** A module as a page shows it, its exports grouped by category. */
export interface ApiModuleHtml extends Omit<
  ApiModule,
  "description" | "exports"
> {
  readonly categories: readonly {
    readonly exports: readonly ApiExportHtml[];
    readonly title: string;
  }[];
  readonly description: string;
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
  // docgen's rule: an example that is not a fenced block is TypeScript.
  examples: await Promise.all(
    entry.examples.map((example) =>
      renderMarkdown(
        example.startsWith("```") ? example : `\`\`\`ts\n${example}\n\`\`\``
      )
    )
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
  };
};

const id = "virtual:api-reference";
const resolvedId = `\0${id}`;

/**
 * `import { modules } from "virtual:api-reference"` gives the library's API reference, read from
 * its source when the docs are built, so it is never out of date.
 */
export const apiReference = (): Plugin => {
  let packageDir = "";
  return {
    configResolved(config) {
      packageDir = path.resolve(
        config.root,
        "../../packages/effect-atom-svelte"
      );
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
      const rendered = await Promise.all(modules.map(renderApiModule));
      return `export const modules = ${JSON.stringify(rendered)};`;
    },
    name: "api-reference",
    resolveId(source) {
      return source === id ? resolvedId : undefined;
    },
  };
};
