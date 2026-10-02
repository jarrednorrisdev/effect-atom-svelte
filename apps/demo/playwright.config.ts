import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  // A failing test keeps a full trace (DOM, network, console): the HTTP filter step has failed rarely
  // under turbo, and the trace is how to find out why. No retries, so that failure stays visible.
  use: { baseURL: "http://localhost:5180", trace: "retain-on-failure" },
  webServer: [
    {
      command: "bun run --cwd ../demo-api dev",
      reuseExistingServer: true,
      url: "http://localhost:3010/api/todos",
    },
    {
      command: "bun run dev",
      reuseExistingServer: true,
      url: "http://localhost:5180",
    },
  ],
});
