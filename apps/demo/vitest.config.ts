import { svelte } from "@sveltejs/vite-plugin-svelte";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// Runs the Testing page's examples (src/routes/testing). Svelte only: the tests
// need none of SvelteKit, mdsvex or the docs plugins in vite.config.ts.
export default defineConfig({
  // Components that await in their script need Svelte's async mode.
  plugins: [svelte({ compilerOptions: { experimental: { async: true } } })],
  // One copy of effect, also for workspace packages such as @demo/domain.
  resolve: { dedupe: ["effect"] },
  test: {
    browser: {
      enabled: true,
      headless: true,
      instances: [{ browser: "chromium" }],
      provider: playwright(),
    },
    include: ["src/**/*.test.ts"],
  },
});
