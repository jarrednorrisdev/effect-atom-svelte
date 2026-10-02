import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  // A failing test keeps a full trace (DOM, network, console). No retries, so a failure stays visible.
  use: { baseURL: "http://localhost:5181", trace: "retain-on-failure" },
  webServer: [
    {
      // Not the --watch dev script: on Windows its child survives Playwright stopping it, and the next
      // run then reuses a server whose in-memory store earlier runs have changed.
      command: "bun run --cwd ../demo-api start",
      reuseExistingServer: !process.env.CI,
      url: "http://localhost:3010/api/todos",
    },
    {
      // A production build, not the dev server: Vite's dev optimizer re-bundles dependencies it
      // discovers mid-run, and a page loading both bundle versions never hydrates. That failed on
      // CI's cold cache.
      command: "bun run build && bun run preview",
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      url: "http://localhost:5181",
    },
  ],
});
