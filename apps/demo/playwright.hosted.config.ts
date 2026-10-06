import { defineConfig, devices } from "@playwright/test";

// The same host and offset as in e2e/servers.ts.
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
    baseURL: `http://127.0.0.1:${5300 + portOffset}`,
    trace: "retain-on-failure",
  },
});
