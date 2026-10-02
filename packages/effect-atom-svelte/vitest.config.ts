import { svelte } from "@sveltejs/vite-plugin-svelte";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [svelte()],
  // @demo/domain is workspace source, so Vite would otherwise load a second copy of effect for it
  // and its schemas and service tags would not match the ones the tests use.
  resolve: { dedupe: ["effect"] },
  test: {
    projects: [
      {
        extends: true,
        test: {
          browser: {
            enabled: true,
            headless: true,
            instances: [{ browser: "chromium" }],
            provider: playwright(),
          },
          include: ["test/**/*.browser.test.ts"],
          name: "browser",
        },
      },
      {
        extends: true,
        test: {
          environment: "node",
          include: ["test/**/*.server.test.ts"],
          name: "server",
        },
      },
    ],
  },
});
