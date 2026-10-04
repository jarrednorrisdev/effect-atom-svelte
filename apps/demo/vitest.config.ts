import { svelte } from "@sveltejs/vite-plugin-svelte";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// Runs the Testing page's examples (src/routes/testing). Svelte only: the tests
// need none of SvelteKit, mdsvex or the docs plugins in vite.config.ts.
export default defineConfig({
  // Examples the tests render use the docs kit (src/lib/docs/kit). Listing its dependencies up
  // front stops Vite from finding them mid-run and reloading the tests, which then fail.
  optimizeDeps: {
    include: [
      "motion",
      "@lucide/svelte/icons/check",
      "@lucide/svelte/icons/circle",
      "@lucide/svelte/icons/circle-alert",
      "@lucide/svelte/icons/loader-circle",
      "@lucide/svelte/icons/x",
    ],
  },
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
