import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { Marked } from "marked";
import { close, createIndex } from "pagefind";
import type { Plugin } from "vite";

import { pages } from "../src/lib/docs/nav.ts";
import { headingId } from "./heading-links.ts";
import { highlightCode } from "./highlight.ts";

const escapeHtml = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");

/** `text` in a `tag` element, or nothing when there is no text. */
const element = (tag: string, text: string | undefined) =>
  text === undefined || text === ""
    ? ""
    : `<${tag}>${escapeHtml(text)}</${tag}>`;

/** A frontmatter field, unquoted. The docs' frontmatter is one line per field. */
export const field = (frontmatter: string, name: string) =>
  new RegExp(`^${name}:\\s*(?<value>.*)$`, "mu")
    .exec(frontmatter)
    ?.groups?.value?.trim()
    .replace(/^(?<quote>["'])(?<text>.*)\k<quote>$/u, "$<text>");

/**
 * A docs page as search sees it, from its `+page.md`, for a page the build can't prerender. The
 * prose, headings (with the ids rehype-slug gives them) and code blocks are the page's own; the
 * live examples and their source files are left out, and components' tags stay as unknown
 * elements, whose text is still indexed.
 */
export const pageFromMarkdown = async (source: string) => {
  const frontmatter =
    /^---\r?\n(?<body>[\s\S]*?)\r?\n---/u.exec(source)?.groups?.body ?? "";
  const body = source
    .slice(frontmatter ? source.indexOf("---", 3) + 3 : 0)
    // The page's imports, not its content.
    .replace(/<script[\s\S]*?<\/script>/u, "");
  const title = field(frontmatter, "title");
  const description = field(frontmatter, "description");
  const ids = new Map<string, number>();
  const markdown = new Marked(highlightCode(), {
    renderer: {
      heading({ depth, tokens }) {
        const text = this.parser.parseInline(tokens);
        // rehype-slug's rule for repeats: the second "Example" is "example-1".
        const base = headingId(tokens.map((token) => token.raw).join(""));
        const count = ids.get(base) ?? 0;
        ids.set(base, count + 1);
        const id = count === 0 ? base : `${base}-${count}`;
        return `<h${depth} id="${id}">${text}</h${depth}>\n`;
      },
    },
  });
  const html = await markdown.parse(body);
  return `<!doctype html><html lang="en"><head><title>${escapeHtml(title ?? "")}</title></head><body><article data-pagefind-body>${element("h1", title)}${element("p", description)}${html}</article></body></html>`;
};

/** A page's prerendered file, as SvelteKit names it: `/` is `index.html`, `/streams` `streams.html`. */
const prerenderedFile = (href: string) =>
  href === "/" ? "index.html" : `${href.slice(1)}.html`;

const exists = async (file: string) => {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
};

/**
 * Indexes the prerendered pages with Pagefind at the end of `vite build`, into the client output so
 * `vite preview` and the adapter serve it at `/pagefind/`. SvelteKit prerenders in its own
 * `buildApp` hook, which runs before this one (this plugin comes after it in `vite.config.ts`);
 * the adapter runs after every other `buildApp` hook, so it copies the index too.
 *
 * A page in the sidebar that isn't prerendered, such as `/browser`, whose cookie example reads the
 * request, is indexed from its Markdown instead, so search still finds it.
 */
export const pagefindIndex = (): Plugin => ({
  apply: "build",
  async buildApp(builder) {
    const { root } = builder.config;
    const output = path.join(root, ".svelte-kit/output");
    const prerendered = path.join(output, "prerendered/pages");
    const { errors, index } = await createIndex();
    if (!index) {
      throw new Error(`Pagefind: ${errors.join(", ")}`);
    }
    const added = await index.addDirectory({ path: prerendered });
    if (added.errors.length > 0 || added.page_count === 0) {
      throw new Error(
        `Pagefind indexed ${added.page_count} pages: ${added.errors.join(", ")}`
      );
    }
    const fromMarkdown = async (href: string) => {
      if (await exists(path.join(prerendered, prerenderedFile(href)))) {
        return;
      }
      const source = path.join(root, "src/routes", href, "+page.md");
      if (!(await exists(source))) {
        throw new Error(
          `Pagefind: ${href} is neither prerendered nor a +page.md, so search can't index it`
        );
      }
      const file = await index.addHTMLFile({
        content: await pageFromMarkdown(await readFile(source, "utf-8")),
        url: href,
      });
      if (file.errors.length > 0) {
        throw new Error(`Pagefind: ${href}: ${file.errors.join(", ")}`);
      }
    };
    await Promise.all(pages.map((page) => fromMarkdown(page.href)));
    const written = await index.writeFiles({
      outputPath: path.join(output, "client/pagefind"),
    });
    if (written.errors.length > 0) {
      throw new Error(`Pagefind: ${written.errors.join(", ")}`);
    }
    await close();
  },
  name: "pagefind-index",
});
