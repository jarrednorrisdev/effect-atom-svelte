import { svelte } from "@sveltejs/vite-plugin-svelte";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import type { BrowserCommand } from "vitest/node";

/**
 * Renders a component with svelte/server in Node and returns its head and body, so a browser test
 * can hydrate real server output (including its hydratable script) instead of mounting from scratch.
 */
const renderOnServer: BrowserCommand<[path: string]> = async (
  { project },
  path
) => {
  const { render } = await project.vite.ssrLoadModule("svelte/server");
  const component = await project.vite.ssrLoadModule(path);
  const { body, head } = await render(component.default);
  return { body, head };
};

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
            commands: { renderOnServer },
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
