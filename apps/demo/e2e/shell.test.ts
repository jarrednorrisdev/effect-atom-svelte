import { expect, test } from "./servers.ts";

test.describe("docs shell", () => {
  test("the sidebar marks the current page and prev/next links follow its order", async ({
    page,
  }) => {
    await page.goto("/reading-and-writing");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveTitle("Reading and writing · effect-atom-svelte");
    const sidebar = page.locator("[data-slot=sidebar]");
    await expect(
      sidebar.getByRole("link", { name: "Reading and writing" })
    ).toHaveAttribute("aria-current", "page");
    const pager = page.getByRole("navigation", { name: "Pages" });
    await expect(
      pager.getByRole("link", { name: /Your first atom/u })
    ).toBeVisible();
    await pager.getByRole("link", { name: /Derived atoms/u }).click();
    await expect(page).toHaveURL(/\/derived-atoms$/u);
    await expect(
      sidebar.getByRole("link", { name: "Derived atoms" })
    ).toHaveAttribute("aria-current", "page");
  });

  test("the table of contents lists a page's sections and links to them", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 800, width: 1400 });
    await page.goto("/rpc");
    await page.waitForLoadState("networkidle");
    const toc = page.getByRole("navigation", { name: "On this page" });
    await expect(toc.getByRole("link")).toHaveText([
      "Defining the client",
      "Queries",
      "Following arguments",
      "Mutations",
      "Streaming procedures",
      "Calling the client yourself",
    ]);
    await toc.getByRole("link", { name: "Streaming procedures" }).click();
    await expect(page).toHaveURL(/#streaming-procedures$/u);
    await expect(
      page.getByRole("heading", { name: "Streaming procedures" })
    ).toBeInViewport();
  });

  test("Example renders the live example above its own source", async ({
    page,
  }) => {
    await page.goto("/reading-and-writing");
    await page.waitForLoadState("networkidle");
    const example = page.locator("[data-example]");
    await expect(
      example.getByText("reading-and-writing.svelte", { exact: true })
    ).toBeVisible();
    await expect(example.locator("pre code")).toContainText(
      'import { useAtom, useAtomSet, useAtomValue } from "effect-atom-svelte";'
    );
    // The preview is the running component, not a picture of it.
    await example.getByRole("button", { exact: true, name: "+" }).click();
    await expect(example.getByTestId("count")).toHaveText("1");
  });

  test("Example shows one tab per file of a multi-file example", async ({
    page,
  }) => {
    await page.goto("/first-atom");
    await page.waitForLoadState("networkidle");
    const example = page.locator("[data-example]");
    const code = example.locator("pre code");
    await expect(code).toContainText("const countAtom = Atom.make(0);");
    await example.getByRole("tab", { name: "counters.svelte" }).click();
    await expect(code).toContainText('import Counter from "./counter.svelte";');
    await expect(code).not.toContainText("Atom.make");
  });

  test("the theme switch persists and applies before any app script runs", async ({
    page,
  }) => {
    await page.goto("/first-atom");
    await page.waitForLoadState("networkidle");
    const html = page.locator("html");
    await expect(html).not.toHaveClass(/dark/u);
    await page.getByRole("button", { name: "Toggle theme" }).click();
    await expect(html).toHaveClass(/dark/u);

    // Without the app's JavaScript, only the inline script in app.html can set the class.
    await page.route("**/_app/**/*.js", (route) => route.abort());
    await page.reload();
    await expect(html).toHaveClass(/dark/u);
  });

  test("with no stored choice the theme follows the system", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/dark/u);
  });

  test("Ctrl+K searches the prerendered pages with Pagefind", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("Control+k");
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder("Search the docs").fill("updater");
    const result = dialog.getByRole("option").filter({ hasText: "updater" });
    await expect(result.first()).toBeVisible();
    await result.first().click();
    await expect(page).toHaveURL(/\/reading-and-writing(?:#.*)?$/u);
    await expect(dialog).toBeHidden();
  });

  test("on small screens the sidebar opens as a sheet and closes after navigating", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 800, width: 390 });
    await page.goto("/scoped-atoms");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Toggle Sidebar" }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("link", { name: "Lifetimes" }).click();
    await expect(page).toHaveURL(/\/lifetimes$/u);
    await expect(sheet).toBeHidden();
  });
});
