import path from "node:path";

import { readApiReference } from "../vite/api-reference.ts";
import { expect, test } from "./servers.ts";

// Read the same way the build reads it, so a new export needs no change here.
const modules = await readApiReference(
  path.resolve(import.meta.dirname, "../../../packages/effect-atom-svelte")
);

test.describe("API reference", () => {
  for (const module of modules) {
    test(`${module.href} documents every export of ${module.file}`, async ({
      page,
    }) => {
      await page.goto(module.href);
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: module.name === "index" ? "effect-atom-svelte" : module.name,
        })
      ).toBeVisible();
      const headings = page.getByRole("article").getByRole("heading", {
        level: 3,
      });
      await expect(headings).toHaveText(
        module.exports.map((entry) => entry.name)
      );
      // By address: the guide pages have a SvelteKit link too.
      await expect(
        page.locator(`[data-slot=sidebar] a[href="${module.href}"]`)
      ).toHaveAttribute("aria-current", "page");
    });
  }

  test("search finds an export in the reference", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("Control+k");
    const dialog = page.getByRole("dialog");
    // Only the reference mentions it, so the match does not depend on ranking.
    await dialog.getByPlaceholder("Search the docs").fill("EffectErrorBody");
    const result = dialog
      .getByRole("option")
      .filter({ hasText: "EffectErrorBody" });
    await result.first().click();
    await expect(page).toHaveURL(/\/reference\/SvelteKit(?:#.*)?$/u);
  });
});
