import { fileURLToPath } from "node:url";

import adapter from "@sveltejs/adapter-auto";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { atomLabels } from "effect-atom-svelte-devtools/vite";
import { mdsvex } from "mdsvex";
import rehypeSlug from "rehype-slug";
import { defineConfig } from "vite";

import { apiReference } from "./vite/api-reference.ts";
import { headingLinks } from "./vite/heading-links.ts";
import { highlightImports, highlightMarkdown } from "./vite/highlight.ts";
import { llms } from "./vite/llms.ts";
import { pagefindIndex } from "./vite/pagefind.ts";

// The e2e suite runs a demo API per worker and points each preview server at its own.
const api = process.env.DEMO_API_ORIGIN ?? "http://localhost:3010";

export default defineConfig({
  plugins: [
    tailwindcss(),
    highlightImports(),
    apiReference(),
    llms(),
    // Names atoms after their variables in dev, for the devtools. Before sveltekit(): it labels
    // components' scripts before they are compiled.
    atomLabels(),
    sveltekit({
      adapter: adapter(),
      compilerOptions: { experimental: { async: true } },
      experimental: { remoteFunctions: true },
      extensions: [".svelte", ".md"],
      // Components' own stylesheets (Example's, Aside's) are a kilobyte or two: inlining them
      // leaves the app stylesheet as the only one that blocks the first paint.
      inlineStyleThreshold: 4096,
      preprocess: [
        mdsvex({
          extensions: [".md"],
          highlight: { highlighter: highlightMarkdown },
          layout: fileURLToPath(
            new URL("src/lib/docs/markdown-layout.svelte", import.meta.url)
          ),
          // Heading ids, for the table of contents and links to a section, then the links.
          rehypePlugins: [rehypeSlug, headingLinks],
        }),
      ],
    }),
    // After sveltekit(): it indexes the pages SvelteKit prerenders.
    pagefindIndex(),
  ],
  // The demo API has no CORS; the browser reaches it same-origin through this proxy.
  preview: {
    port: 5181,
    proxy: { "/api": api },
    strictPort: true,
  },
  server: {
    port: 5180,
    proxy: { "/api": api },
    strictPort: true,
  },
});
