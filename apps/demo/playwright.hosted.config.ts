import { defineConfig, devices } from "@playwright/test";

// The same offset as portOffset in e2e/servers.ts.
const portOffset = Number(process.env.E2E_PORT_OFFSET ?? 0);

// The hosted build (VITE_DEMO_API=in-tab), previewed with no demo API running: the examples must
// work from the API in the page. It runs after the main suite and replaces its build.
export default defineConfig({
  fullyParallel: true,
  globalSetup: "./e2e-hosted/setup.ts",
  // The in-tab API's code is the same in every engine; one is enough to show the build works.
  projects: [{ name: "chromium", use: devices["Desktop Chrome"] }],
  testDir: "e2e-hosted",
  use: {
    baseURL: `http://localhost:${5300 + portOffset}`,
    trace: "retain-on-failure",
  },
  // As in playwright.config.ts: two workers on CI's two-core runner rather than the default one.
  workers: process.env.CI ? 2 : undefined,
});
