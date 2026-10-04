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

// Lucide's copy and check icons, inlined: this HTML is static, so no Svelte component renders it.
const icon = (className: string, body: string) =>
  `<svg aria-hidden="true" class="${className}" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">${body}</svg>`;
const copyButton = `<button aria-label="Copy code" class="copy-code" data-copy-code type="button">${icon(
  "copy-icon",
  '<rect height="14" rx="2" ry="2" width="14" x="8" y="8"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>'
)}${icon("copied-icon", '<path d="M20 6 9 17l-5-5"/>')}</button>`;

/**
 * Highlights code at build time, so the browser gets plain HTML and no highlighter. The block
 * comes with a copy button, which `src/lib/docs/copy-code.ts` handles for the whole page. Code
 * counts for half as much as prose in search, so a page's prose wins the ranking and the excerpt
 * when both match, while identifiers stay searchable.
 */
export const highlight = async (code: string, lang: string) => {
  const shiki = await highlighter;
  const html = shiki.codeToHtml(code, {
    defaultColor: false,
    lang: shiki.getLoadedLanguages().includes(lang) ? lang : "text",
    themes,
    transformers: [
      {
        // app.css sizes the line number gutter to fit the last line's number.
        pre(node) {
          const digits = String(this.lines.length).length;
          node.properties.style = `${node.properties.style ?? ""};--line-number-width:${digits}ch`;
          // A lone "1" says nothing, so one-line blocks have no line numbers.
          if (this.lines.length === 1) {
            this.addClassToHast(node, "single-line");
          }
        },
      },
    ],
  });
  return `<div class="code-block" data-pagefind-weight="0.5">${html}${copyButton}</div>`;
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
