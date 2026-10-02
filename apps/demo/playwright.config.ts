import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  // Tests share no state: each worker runs its own demo API and preview server (e2e/servers.ts).
  fullyParallel: true,
  // A production build, not the dev server: Vite's dev optimizer re-bundles dependencies it
  // discovers mid-run, and a page loading both bundle versions never hydrates. That failed on
  // CI's cold cache.
  globalSetup: "./e2e/build.ts",
  // Engines differ in microtask timing (which the hooks' notification deferral depends on) and in
  // visibilitychange behaviour, so every test runs in all three.
  projects: [
    { name: "chromium", use: devices["Desktop Chrome"] },
    { name: "firefox", use: devices["Desktop Firefox"] },
    { name: "webkit", use: devices["Desktop Safari"] },
  ],
  testDir: "e2e",
  // A failing test keeps a full trace (DOM, network, console). No retries, so a failure stays visible.
  use: { trace: "retain-on-failure" },
});
