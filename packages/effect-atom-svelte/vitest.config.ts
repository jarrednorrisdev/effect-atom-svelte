import { svelte } from "@sveltejs/vite-plugin-svelte";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [svelte()],
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
