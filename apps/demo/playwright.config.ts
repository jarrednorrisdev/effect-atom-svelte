import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://localhost:5180" },
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
