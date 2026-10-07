import { markdown as reference } from "virtual:api-reference";
import { pages as guides } from "virtual:llms";

import { markdownHref, nav } from "./nav.ts";
import { siteName, siteUrl } from "./site.ts";

/**
 * The docs as Markdown, for language models (https://llmstxt.org): `/llms.txt`, `/llms-full.txt`
 * and each page's `.md`, in the sidebar's order. The guide pages' Markdown comes from
 * `vite/llms.ts`, the API reference's from `vite/api-reference.ts`.
 */

/** A page as Markdown: its title, its description and its body. */
interface TextPage {
  readonly body: string;
  readonly description: string;
  readonly href: string;
  readonly title: string;
}

const summary =
  "Svelte 5 bindings for Effect Atom (`effect/reactivity`): hooks to read and write atoms from components, server rendering and hydration. A community project, not part of Effect.";

// What a model most often gets wrong when it writes code for the library from what it knows of
// atom-react or of Svelte stores. Each point is taught on the page it links to.
const essentials = `Before writing code with it:

- Install \`effect@~4.0.0\` alongside \`effect-atom-svelte\`. The bindings use parts of the atom registry that aren't public API, so another minor version of \`effect\` can break them. See [Installation](${siteUrl}/installation.md).
- Atoms are made with \`Atom\` from \`effect/reactivity\`; the hooks and \`RegistryProvider\` come from \`effect-atom-svelte\`. Put a \`RegistryProvider\` around the app: every hook reads the nearest one.
- A hook returns an object with a reactive \`current\`, Svelte's convention: read it in markup, assign to it, or \`bind:\` to it. See [Reading and writing](${siteUrl}/reading-and-writing.md).
- \`useAtomSuspense\`, \`useAtomResult\` and server rendering need Svelte's \`compilerOptions: { experimental: { async: true } }\`.
- Define atoms in a module or a component's \`<script module>\`. An atom made in a component's \`<script>\` is a new atom for every instance.
- The API follows \`@effect/atom-react\`: [Migrating from atom-react](${siteUrl}/migrating-from-react.md) maps one to the other.`;

// The live examples' source is shown as it runs on the site, so it uses the site's own pieces.
const aboutExamples = `## About the examples

Each live example on the site appears here as a **Live example** line, saying what it shows, and then its source files. They use parts of the docs site that are not part of effect-atom-svelte, so leave them out of an app:

- Imports from \`#lib/docs/kit/\`, such as \`Part\`, \`FlashValue\`, \`StateBadge\`, \`ResultChip\` and \`EventLog\`, are the site's display components.
- \`#lib/clients.ts\` defines the clients for the site's demo API, which the RPC and HTTP API pages show how to write.
- \`data-cue\` and \`data-testid\` attributes drive the site's sounds and its tests.`;

/** Links from the site's root, and to a section of the same page, made absolute. */
const absoluteLinks = (text: string, href: string) =>
  text
    .replaceAll("](/", `](${siteUrl}/`)
    .replaceAll("](#", `](${siteUrl}${href}#`);

const referenceDescription = (title: string) =>
  title === "API overview"
    ? "The package's entry points, and what each exports."
    : `The ${title} module: every export, with its signature and examples.`;

/** Every page, in the sidebar's order, grouped by its section. */
const sections = nav.map((section) => ({
  pages: section.pages.map((page): TextPage => {
    const guide = guides.find((entry) => entry.href === page.href);
    if (guide) {
      return guide;
    }
    const module = reference.find((entry) => entry.href === page.href);
    if (!module) {
      throw new Error(`No Markdown for ${page.href}`);
    }
    return {
      body: module.text,
      description: referenceDescription(page.title),
      href: page.href,
      title: page.title,
    };
  }),
  title: section.title,
}));

const allPages = sections.flatMap((section) => section.pages);

/** Every page's Markdown address, for prerendering. */
export const markdownHrefs = allPages.map((page) => markdownHref(page.href));

const pageText = (page: TextPage) =>
  [
    `# ${page.title}`,
    `> ${page.description}`,
    `Source: ${siteUrl}${page.href}`,
    absoluteLinks(page.body, page.href),
  ].join("\n\n");

/** A page as Markdown, by its Markdown address, or undefined for no page. */
export const pageMarkdown = (path: string) => {
  const page = allPages.find((entry) => markdownHref(entry.href) === path);
  return page && `${pageText(page)}\n`;
};

/** The index: what the library is and what to know first, then every page with its description. */
export const llmsIndex = () =>
  `${[
    `# ${siteName}`,
    `> ${summary}`,
    essentials,
    `The links below are Markdown; any page's address with \`.md\` added gives its Markdown (\`/index.md\` for the introduction). Every page in one file: [llms-full.txt](${siteUrl}/llms-full.txt)`,
    ...sections.map((section) =>
      [
        `## ${section.title}`,
        "",
        ...section.pages.map(
          (page) =>
            `- [${page.title}](${siteUrl}${markdownHref(page.href)}): ${page.description}`
        ),
      ].join("\n")
    ),
  ].join("\n\n")}\n`;

/** Every page in full, in reading order, after what to know first and a note on the examples. */
export const llmsFull = () => {
  const header = [`# ${siteName}`, `> ${summary}`, essentials, aboutExamples];
  return `${[header.join("\n\n"), ...allPages.map(pageText)].join("\n\n---\n\n")}\n`;
};
