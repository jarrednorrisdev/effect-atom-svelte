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

  test("every page says the project is not made by the Effect team", async ({
    page,
  }) => {
    await page.goto("/derived-atoms");
    await expect(page.getByRole("banner")).toContainText("Community project");
    await expect(page.locator("footer")).toContainText(
      "not made or endorsed by the Effect team"
    );
  });

  test("the GitHub button is disabled and says why until the repository is public", async ({
    page,
  }) => {
    await page.goto("/first-atom");
    await page.waitForLoadState("networkidle");
    const button = page.getByRole("button", { name: /^GitHub repository/u });
    await expect(button).toBeVisible();
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute("aria-disabled", "true");
    await expect(button).toHaveAccessibleName(/goes public soon/u);
    const tooltip = page.getByRole("tooltip");
    await expect(tooltip).toBeHidden();

    // Keyboard focus shows the tooltip; Escape hides it.
    await page.getByRole("button", { name: "Search" }).focus();
    await page.keyboard.press("Tab");
    await expect(button).toBeFocused();
    await expect(tooltip).toHaveText("The repository goes public soon");
    await page.keyboard.press("Escape");
    await expect(tooltip).toBeHidden();

    // A click (or a tap) shows it too, and goes nowhere. Playwright won't click an aria-disabled
    // element unless forced, but browsers still deliver the click.
    await button.click({ force: true });
    await expect(tooltip).toHaveText("The repository goes public soon");
    await expect(page).toHaveURL(/\/first-atom$/u);
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
    await expect(
      toc.getByRole("link", { name: "Streaming procedures" })
    ).toHaveAttribute("aria-current", "location");
    await expect(
      toc.getByRole("link", { name: "Streaming procedures" })
    ).toHaveCSS("border-left-color", /^(?!rgba\(0, 0, 0, 0\))/u);
  });

  test("below 1280 px the table of contents is a menu above the page", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto("/rpc");
    await page.waitForLoadState("networkidle");
    const menu = page.locator(".toc-menu");
    await menu.getByText("On this page").click();
    const toc = page.getByRole("navigation", { name: "On this page" });
    await toc.getByRole("link", { name: "Streaming procedures" }).click();
    await expect(page).toHaveURL(/#streaming-procedures$/u);
    await expect(toc).toBeHidden();
    await expect(menu).toContainText("Streaming procedures");
  });

  test("every code block has a copy button that copies its code", async ({
    page,
  }) => {
    // Only Chromium lets a test read the clipboard, so record what the page writes instead.
    await page.addInitScript(() => {
      const copied: string[] = [];
      Object.assign(window, { copied });
      navigator.clipboard.writeText = (text) => {
        copied.push(text);
        return Promise.resolve();
      };
    });
    await page.goto("/installation");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Copy code" }).first().click();
    await expect
      .poll(() =>
        page.evaluate(() => (window as unknown as { copied: string[] }).copied)
      )
      .toEqual(["npm install effect effect-atom-svelte"]);
    await expect(
      page.getByRole("button", { name: "Copied" }).first()
    ).toBeAttached();
  });

  test("one-line code blocks and phones show no line numbers", async ({
    page,
  }) => {
    const gutter = (selector: string) =>
      page
        .locator(selector)
        .first()
        .evaluate((line) => window.getComputedStyle(line, "::before").display);
    await page.goto("/installation");
    await page.waitForLoadState("networkidle");
    await expect.poll(() => gutter(".shiki.single-line .line")).toBe("none");
    await expect
      .poll(() => gutter(".shiki:not(.single-line) .line"))
      .not.toBe("none");
    await page.setViewportSize({ height: 844, width: 390 });
    await expect
      .poll(() => gutter(".shiki:not(.single-line) .line"))
      .toBe("none");
  });

  test("the sidebar scrolls the current page's link into view", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 700, width: 1280 });
    await page.goto("/reference/SvelteKit");
    await page.waitForLoadState("networkidle");
    await expect(
      page
        .locator("[data-slot=sidebar]")
        .locator('a[href="/reference/SvelteKit"]')
    ).toBeInViewport();
  });

  test("each page has its own description, a canonical link and a link preview", async ({
    page,
  }) => {
    await page.goto("/first-atom");
    const description = page.locator('meta[name="description"]');
    await expect(description).toHaveCount(1);
    await expect(description).toHaveAttribute(
      "content",
      "Define an atom, read and write it from a component, and share it."
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://atom.jarrednorris.dev/first-atom"
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      "https://atom.jarrednorris.dev/og-image.png"
    );

    // Client-side navigation swaps the description rather than adding one.
    await page.waitForLoadState("networkidle");
    await page
      .locator("[data-slot=sidebar]")
      .locator('a[href="/reference/Hooks"]')
      .click();
    await expect(page).toHaveURL(/\/reference\/Hooks$/u);
    await expect(description).toHaveCount(1);
    await expect(description).toHaveAttribute("content", /Hooks module/u);
  });

  test("the favicon, preview image and sitemap are served", async ({
    request,
  }) => {
    const responses = await Promise.all(
      ["/favicon.ico", "/favicon.svg", "/og-image.png"].map((path) =>
        request.get(path)
      )
    );
    expect(responses.map((response) => response.ok())).toEqual([
      true,
      true,
      true,
    ]);
    const sitemap = await request.get("/sitemap.xml");
    expect(await sitemap.text()).toContain(
      "<loc>https://atom.jarrednorris.dev/reference/Hooks</loc>"
    );
  });

  test("an unknown path shows a not-found page inside the docs shell", async ({
    page,
  }) => {
    const response = await page.goto("/no-such-page");
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { level: 1, name: "Page not found" })
    ).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Docs" })).toBeAttached();
  });

  test("on a phone, a multi-file example scrolls its tabs instead of the page", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto("/scoped-atoms");
    await page.waitForLoadState("networkidle");
    const widths = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(widths[0]).toBe(widths[1]);
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

  test("the sound switch persists, and no example plays a note while it is off", async ({
    page,
  }) => {
    // Counts the notes the page starts, since a test can't listen to them.
    await page.addInitScript(() => {
      const counter = window as unknown as { notes: number };
      counter.notes = 0;
      const original = OscillatorNode.prototype.start;
      OscillatorNode.prototype.start = function start(
        this: OscillatorNode,
        ...args: Parameters<OscillatorNode["start"]>
      ) {
        counter.notes += 1;
        original.apply(this, args);
      };
    });
    const notes = () =>
      page.evaluate(() => (window as unknown as { notes: number }).notes);
    // Tone.js is the only script that names itself "Tone.js"; count the times it is downloaded.
    let toneLoads = 0;
    page.on("response", async (response) => {
      if (response.url().endsWith(".js")) {
        const body = await response.text().catch(() => "");
        if (body.includes("Tone.js")) {
          toneLoads += 1;
        }
      }
    });
    await page.goto("/first-atom");
    await page.waitForLoadState("networkidle");
    const toggle = page.getByRole("button", { name: "Sound effects" });
    const increment = page.getByRole("button", {
      name: "First counter: increment",
    });
    // On by default, but Tone.js waits for the first click that plays a note.
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(toneLoads).toBe(0);
    await increment.click();
    await expect.poll(notes).toBeGreaterThan(0);
    expect(toneLoads).toBe(1);

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await increment.click();
    await expect(page.locator("[data-example] output").first()).toHaveText("1");
    await page.waitForTimeout(200);
    expect(await notes()).toBe(0);
    // While sound is off, Tone.js never loads.
    expect(toneLoads).toBe(1);

    // Turning it back on plays a note to confirm, and is remembered too.
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect.poll(notes).toBeGreaterThan(0);
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
  });

  test("the sound switch shows off before any app script runs", async ({
    page,
  }) => {
    await page.goto("/first-atom");
    await page.waitForLoadState("networkidle");
    const toggle = page.getByRole("button", { name: "Sound effects" });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");

    // Without the app's JavaScript, only the inline script in app.html can pick the icon.
    await page.route("**/_app/**/*.js", (route) => route.abort());
    await page.reload();
    await expect(toggle.locator(".sound-off-icon")).toBeVisible();
    await expect(toggle.locator(".sound-on-icon")).toBeHidden();
  });

  test("on a phone the search button is an icon that still opens search", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const search = page.getByRole("button", { name: "Search" });
    await expect(search).toBeVisible();
    await expect(search).not.toContainText("Search", { useInnerText: true });
    const box = await search.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(40);
    await search.click();
    await expect(
      page.getByRole("dialog").getByPlaceholder("Search the docs")
    ).toBeFocused();
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
    // A word only one page uses, so the match does not depend on ranking or excerpts.
    await dialog.getByPlaceholder("Search the docs").fill("Fahrenheit");
    const result = dialog.getByRole("option").filter({ hasText: "Fahrenheit" });
    await expect(result.first()).toBeVisible();
    await result.first().click();
    await expect(page).toHaveURL(/\/derived-atoms(?:#.*)?$/u);
    await expect(dialog).toBeHidden();
  });

  test("the search button loads and opens the search dialog", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // The dialog loads on first use, so it isn't on the page until then.
    await expect(page.getByPlaceholder("Search the docs")).toHaveCount(0);
    await page.getByRole("button", { name: "Search" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByPlaceholder("Search the docs")).toBeFocused();
    await expect(
      dialog.getByRole("option", { name: "Installation" })
    ).toBeVisible();
    await page.keyboard.press("Escape");
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
