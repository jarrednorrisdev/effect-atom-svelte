import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Plugin } from "vite";

import { guide, guideCaption } from "../src/lib/docs/atoms-guide.ts";
import { pages } from "../src/lib/docs/nav.ts";
import { headingId } from "./heading-links.ts";
import { field } from "./pagefind.ts";

/**
 * The guide pages as plain Markdown, for `/llms.txt`, `/llms-full.txt` and each page's `.md`:
 * each `+page.md` with its components replaced by what they show. A live example becomes its hint,
 * a link to try it and the source of its files; an aside becomes a blockquote, the install command
 * its commands and the atoms guide a table. A component this doesn't know fails the build, so a new
 * one can't leave a bare tag in the text.
 */

/** A guide page as Markdown: its frontmatter's title and description, and its body. */
export interface LlmsPage {
  readonly body: string;
  readonly description: string;
  readonly href: string;
  readonly title: string;
}

/** A fenced block, with a fence longer than any run of backticks in the code. */
const fence = (code: string, lang: string) => {
  const longest = Math.max(
    2,
    ...(code.match(/`+/gu) ?? []).map((run) => run.length)
  );
  const marks = "`".repeat(longest + 1);
  return `${marks}${lang}\n${code}\n${marks}`;
};

/** The guide to when to reach for atoms, which the page shows as a table, as a Markdown table. */
const guideTable = [
  `${guideCaption}:`,
  "",
  "| You need | Reach for |",
  "| --- | --- |",
  ...guide.map((row) => `| ${row.need} | **${row.tool}**: ${row.why} |`),
].join("\n");

const asideLabels: Readonly<Record<string, string>> = {
  caution: "Caution",
  danger: "Danger",
  note: "Note",
  tip: "Tip",
};

/**
 * A component's tag left in the prose, which the page would render but the text can't. Code
 * blocks, also those quoted in an aside, and inline code are left out: their tags are code.
 */
const leftoverTag = (text: string) =>
  /<\/?[A-Z]\w*/u.exec(
    text
      .replaceAll(/^[> \t]*```[\s\S]*?^[> \t]*```[ \t]*$/gmu, "")
      .replaceAll(/`[^`\n]*`/gu, "")
  )?.[0];

interface PluginContext {
  readonly resolve: (
    source: string,
    importer: string
  ) => Promise<{ readonly id: string } | null>;
  readonly addWatchFile: (file: string) => void;
}

/** Reads a page's `+page.md` and replaces its components. */
const readPage = async (
  context: PluginContext,
  routes: string,
  installCommands: string,
  { href, title }: { href: string; title: string }
): Promise<LlmsPage> => {
  const file = path.join(routes, href, "+page.md");
  context.addWatchFile(file);
  const text = await readFile(file, "utf-8");
  const source = text.replaceAll("\r\n", "\n");
  const frontmatter =
    /^---\n(?<body>[\s\S]*?)\n---\n/u.exec(source)?.groups?.body ?? "";
  const afterFrontmatter = frontmatter
    ? source.slice(source.indexOf("\n---\n") + 5)
    : source;
  const script =
    /<script>(?<body>[\s\S]*?)<\/script>/u.exec(afterFrontmatter)?.groups
      ?.body ?? "";

  // `import clockSource from "./clock.svelte?highlight"`: the file each example shows.
  const sources = new Map<string, { code: string; lang: string }>();
  for (const match of script.matchAll(
    /import (?<name>\w+) from "(?<spec>[^"]+)\?highlight";/gu
  )) {
    const { name = "", spec = "" } = match.groups ?? {};
    // oxlint-disable-next-line eslint/no-await-in-loop -- a handful of imports per page
    const resolved = await context.resolve(spec, file);
    if (!resolved) {
      throw new Error(`${file}: can't find ${spec}`);
    }
    context.addWatchFile(resolved.id);
    // oxlint-disable-next-line eslint/no-await-in-loop -- a handful of imports per page
    const code = await readFile(resolved.id, "utf-8");
    sources.set(name, {
      code: code.replaceAll("\r\n", "\n").trimEnd(),
      lang: path.extname(resolved.id).slice(1),
    });
  }

  const sourceFiles = (files: string) =>
    [...files.matchAll(/html: (?<name>\w+), name: "(?<label>[^"]+)"/gu)]
      .map((match) => {
        const { label = "", name = "" } = match.groups ?? {};
        const shown = sources.get(name);
        if (!shown) {
          throw new Error(`${file}: the example's ${name} is not imported`);
        }
        return `\`${label}\`:\n\n${fence(shown.code, shown.lang)}`;
      })
      .join("\n\n");

  /**
   * An example with something to try (children it renders) is introduced by its hint and a link to
   * the section it's in; one that only shows files, as the Testing page's tests, is just the files.
   */
  const example = (
    files: string,
    hint: string | undefined,
    live: boolean,
    before: string
  ) => {
    if (!live) {
      return sourceFiles(files);
    }
    const heading = [...before.matchAll(/^#{2,3} (?<text>.+)$/gmu)].at(-1)
      ?.groups?.text;
    const at = heading === undefined ? href : `${href}#${headingId(heading)}`;
    const intro = [`**Live example** ([try it](${at}))`, hint]
      .filter(Boolean)
      .join(": ");
    return `${intro}\n\n${sourceFiles(files)}`;
  };

  const aside = (type: string, asideTitle: string, content: string) => {
    const label = asideLabels[type];
    if (!label) {
      throw new Error(`${file}: an aside of unknown type ${type}`);
    }
    const heading = asideTitle ? `**${label}: ${asideTitle}**` : `**${label}**`;
    return `${heading}\n\n${content.trim()}`
      .split("\n")
      .map((line) => (line === "" ? ">" : `> ${line}`))
      .join("\n");
  };

  const body = afterFrontmatter
    .replace(/<script>[\s\S]*?<\/script>\n*/u, "")
    .replaceAll(
      /<Example files=\{\[(?<files>.*?)\]\}(?: hint="(?<hint>[^"]*)")?\s*(?<end>\/>|>.*?<\/Example>)/gsu,
      (
        _match,
        files: string,
        hint: string | undefined,
        end: string,
        offset: number,
        whole: string
      ) => example(files, hint, end !== "/>", whole.slice(0, offset))
    )
    .replaceAll(
      /<Aside type="(?<type>\w+)"(?: title="(?<title>[^"]*)")?>(?<content>[\s\S]*?)<\/Aside>/gu,
      (_match, type: string, asideTitle: string | undefined, content: string) =>
        aside(type, asideTitle ?? "", content)
    )
    .replaceAll("<InstallCommand />", installCommands)
    .replaceAll("<AtomsGuide />", guideTable)
    .trim();

  const tag = leftoverTag(body);
  if (tag !== undefined) {
    throw new Error(
      `${file}: vite/llms.ts doesn't know how to write ${tag}> as Markdown`
    );
  }
  return {
    body,
    description: field(frontmatter, "description") ?? "",
    href,
    title,
  };
};

const id = "virtual:llms";
const resolvedId = `\0${id}`;

/**
 * `import { pages } from "virtual:llms"` gives every guide page in the sidebar as Markdown, read
 * from its `+page.md` when the docs are built. The API reference comes from `virtual:api-reference`.
 */
export const llms = (): Plugin => {
  let lib = "";
  let routes = "";
  return {
    configResolved(config) {
      lib = path.resolve(config.root, "src/lib");
      routes = path.resolve(config.root, "src/routes");
    },
    async load(loading) {
      if (loading !== resolvedId) {
        return;
      }
      // The tabs show one command per package manager; the text lists them all.
      const commands = await Promise.all(
        ["bun", "pnpm", "npm"].map((manager) =>
          readFile(path.join(lib, "docs/install", `${manager}.bash`), "utf-8")
        )
      );
      const installCommands = fence(
        commands.map((command) => command.trim()).join("\n"),
        "bash"
      );
      const guides = pages.filter(
        (page) => !page.href.startsWith("/reference")
      );
      const read = await Promise.all(
        guides.map((page) => readPage(this, routes, installCommands, page))
      );
      return `export const pages = ${JSON.stringify(read)};`;
    },
    name: "llms",
    resolveId(source) {
      return source === id ? resolvedId : undefined;
    },
  };
};
