import { readFile } from "node:fs/promises";
import path from "node:path";

import { escapeSvelte } from "mdsvex";
import { createHighlighter } from "shiki";
import type { Plugin } from "vite";

const themes = { dark: "github-dark", light: "github-light" } as const;
const langs = ["bash", "json", "svelte", "ts"] as const;

const highlighter = createHighlighter({
  langs: [...langs],
  themes: Object.values(themes),
});

/** Highlights code at build time, so the browser gets plain HTML and no highlighter. */
export const highlight = async (code: string, lang: string) => {
  const shiki = await highlighter;
  return shiki.codeToHtml(code, {
    defaultColor: false,
    lang: shiki.getLoadedLanguages().includes(lang) ? lang : "text",
    themes,
  });
};

/** For mdsvex: highlighted HTML that Svelte will not parse as markup. */
export const highlightMarkdown = async (
  code: string,
  lang: string | null | undefined
) => `{@html \`${escapeSvelte(await highlight(code, lang ?? "text"))}\`}`;

const query = "?highlight";
// A virtual id ending in .js, so the Svelte plugin does not compile `Example.svelte?highlight`.
const prefix = "\0highlight:";
const suffix = ".js";

/**
 * `import html from "./Example.svelte?highlight"` gives that file's source as highlighted HTML,
 * so docs show the code that runs.
 */
export const highlightImports = (): Plugin => ({
  enforce: "pre",
  async load(id) {
    if (!id.startsWith(prefix)) {
      return;
    }
    const file = id.slice(prefix.length, -suffix.length);
    this.addWatchFile(file);
    const html = await highlight(
      await readFile(file, "utf-8"),
      path.extname(file).slice(1)
    );
    return `export default ${JSON.stringify(html)};`;
  },
  name: "highlight-imports",
  async resolveId(source, importer) {
    if (!source.endsWith(query)) {
      return;
    }
    const resolved = await this.resolve(
      source.slice(0, -query.length),
      importer
    );
    return resolved && `${prefix}${resolved.id}${suffix}`;
  },
});
