import path from "node:path";

import * as pagefind from "pagefind";
import type { Plugin } from "vite";

/**
 * Indexes the prerendered pages with Pagefind at the end of `vite build`, into the client output so
 * `vite preview` and the adapter serve it at `/pagefind/`. SvelteKit prerenders in its own
 * `buildApp` hook, which runs before this one (this plugin comes after it in `vite.config.ts`);
 * the adapter runs after every other `buildApp` hook, so it copies the index too.
 */
export const pagefindIndex = (): Plugin => ({
  apply: "build",
  async buildApp(builder) {
    const output = path.join(builder.config.root, ".svelte-kit/output");
    const { errors, index } = await pagefind.createIndex();
    if (!index) {
      throw new Error(`Pagefind: ${errors.join(", ")}`);
    }
    const added = await index.addDirectory({
      path: path.join(output, "prerendered/pages"),
    });
    if (added.errors.length > 0 || added.page_count === 0) {
      throw new Error(
        `Pagefind indexed ${added.page_count} pages: ${added.errors.join(", ")}`
      );
    }
    const written = await index.writeFiles({
      outputPath: path.join(output, "client/pagefind"),
    });
    if (written.errors.length > 0) {
      throw new Error(`Pagefind: ${written.errors.join(", ")}`);
    }
    await pagefind.close();
  },
  name: "pagefind-index",
});
