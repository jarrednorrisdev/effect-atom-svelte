import { readFile } from "node:fs/promises";
import path from "node:path";

import { escapeSvelte } from "mdsvex";
import { createHighlighter } from "shiki";
import githubDark from "shiki/themes/github-dark.mjs";
import githubLight from "shiki/themes/github-light.mjs";
import type { Plugin } from "vite";

/**
 * effect.website's code blocks: GitHub's themes with Expressive Code's contrast fix, which darkens
 * light colours (and lightens one dark colour) that read poorly on the code background. The
 * replacements were read off the colours effect.website renders for the same tokens.
 */
const effectLight = {
  ...githubLight,
  colorReplacements: {
    "#22863a": "#1d7131",
    "#6a737d": "#5b636b",
    "#d73a49": "#b5313e",
    "#e36209": "#a34606",
  },
  name: "effect-light",
};
const effectDark = {
  ...githubDark,
  colorReplacements: { "#6a737d": "#899198" },
  name: "effect-dark",
};

const themes = { dark: effectDark.name, light: effectLight.name } as const;
const langs = ["bash", "json", "svelte", "ts"] as const;

const highlighter = createHighlighter({
  langs: [...langs],
  themes: [effectLight, effectDark],
});

/** Highlights code at build time, so the browser gets plain HTML and no highlighter. */
export const highlight = async (code: string, lang: string) => {
  const shiki = await highlighter;
  return shiki.codeToHtml(code, {
    defaultColor: false,
    lang: shiki.getLoadedLanguages().includes(lang) ? lang : "text",
    themes,
    transformers: [
      {
        // app.css sizes the line number gutter to fit the last line's number.
        pre(node) {
          const digits = String(this.lines.length).length;
          node.properties.style = `${node.properties.style ?? ""};--line-number-width:${digits}ch`;
        },
      },
    ],
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
    const source = await readFile(file, "utf-8");
    const html = await highlight(source.trimEnd(), path.extname(file).slice(1));
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
