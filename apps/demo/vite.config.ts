import adapter from "@sveltejs/adapter-auto";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { mdsvex } from "mdsvex";
import { defineConfig } from "vite";

import { highlightImports, highlightMarkdown } from "./vite/highlight.ts";

// The e2e suite runs a demo API per worker and points each preview server at its own.
const api = process.env.DEMO_API_ORIGIN ?? "http://localhost:3010";

export default defineConfig({
  plugins: [
    tailwindcss(),
    highlightImports(),
    sveltekit({
      adapter: adapter(),
      compilerOptions: { experimental: { async: true } },
      experimental: { remoteFunctions: true },
      extensions: [".svelte", ".md"],
      preprocess: [
        mdsvex({
          extensions: [".md"],
          highlight: { highlighter: highlightMarkdown },
        }),
      ],
    }),
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
