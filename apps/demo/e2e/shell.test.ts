import { pages as navPages } from "../src/lib/docs/nav.ts";
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

  test("the footer links the docs' Markdown for AI assistants", async ({
    page,
  }) => {
    await page.goto("/derived-atoms");
    await page
      .locator("footer")
      .getByRole("link", { name: "llms.txt" })
      .click();
    await expect(page).toHaveURL(/\/llms\.txt$/u);
    await expect(page.locator("body")).toContainText("# effect-atom-svelte");
  });

  test("the GitHub button links to the repository", async ({ page }) => {
    await page.goto("/first-atom");
    const link = page.getByRole("link", { name: "GitHub repository" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute(
      "href",
      "https://github.com/jarrednorrisdev/effect-atom-svelte"
    );
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
      "On the server",
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
      .toEqual(['bun add "effect@~4.0.0" effect-atom-svelte']);
    await expect(
      page.getByRole("button", { name: "Copied" }).first()
    ).toBeAttached();
  });

  test("the install command remembers the package manager", async ({
    page,
  }) => {
    await page.goto("/installation");
    await expect(page.locator("html[data-hydrated]")).toBeAttached();
    const shown = page.locator(".install-command pre:visible");
    await expect(shown).toHaveText(
      'bun add "effect@~4.0.0" effect-atom-svelte'
    );
    await page.getByRole("tab", { name: "pnpm" }).click();
    await expect(shown).toHaveText(
      'pnpm add "effect@~4.0.0" effect-atom-svelte'
    );
    // Kept in localStorage, so the next visit opens on pnpm.
    await page.reload();
    await expect(page.locator("html[data-hydrated]")).toBeAttached();
    await expect(page.getByRole("tab", { name: "pnpm" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(shown).toHaveText(
      'pnpm add "effect@~4.0.0" effect-atom-svelte'
    );
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

  test("the landing page has the whole width and links to every page", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: /Read it in any component/u })
    ).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://atom.jarrednorris.dev/"
    );
    // The hero opens on the code, and its other tab compares Svelte with atoms.
    await expect(page.getByTestId("hero-code")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.getByRole("tab", { name: "Svelte or atoms?" }).click();
    await expect(page.getByTestId("comparison")).toContainText(
      "One atom, one run, shared"
    );
    await expect(page.getByTestId("hero-code")).toBeHidden();
    // See it run scrolls down to the reasons, rather than leaving the page.
    await page.getByRole("link", { name: "See it run" }).click();
    await expect(
      page.getByRole("heading", { name: "Where atoms fit" })
    ).toBeInViewport();
    await expect(page).toHaveURL(/\/$/u);
    // No sidebar on wide screens: the page map at the foot lists the pages instead.
    await expect(page.locator("[data-slot=sidebar]")).toHaveCount(0);
    const map = page.getByRole("navigation", { name: "All pages" });
    await expect(map.getByRole("link")).toHaveCount(navPages.length);
    await expect(page.locator("footer")).toContainText(
      "not made or endorsed by the Effect team"
    );

    await page.waitForLoadState("networkidle");
    await page.getByRole("link", { name: "Get started" }).first().click();
    await expect(page).toHaveURL(/\/introduction$/u);
    await expect(
      page
        .locator("[data-slot=sidebar]")
        .getByRole("link", { name: "Introduction" })
    ).toHaveAttribute("aria-current", "page");
  });

  test("the landing page's examples show each reason to use atoms", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // 01: two components read rateAtom and share one run; a refresh runs it once, for both.
    const log = page.getByTestId("rate-log");
    const started = log.getByText("effect started");
    await page.getByRole("button", { name: "Show the header" }).click();
    const header = page.getByTestId("header-rate");
    await expect(header).toHaveText(/^\d\.\d{4}$/u);
    await page.getByRole("button", { name: "Show the checkout" }).click();
    const checkout = page.getByTestId("checkout-rate");
    await expect(checkout).toHaveText((await header.textContent()) ?? "");
    await expect(started).toHaveCount(1);
    await page.getByRole("button", { name: "Refresh" }).first().click();
    await expect(started).toHaveCount(2);
    await expect(log.getByText("effect returned")).toHaveCount(2);
    await expect(checkout).toHaveText((await header.textContent()) ?? "");

    // 02: a typed TodoNotFound, matched in markup.
    const lookup = page.getByTestId("lookup");
    await expect(lookup).toHaveText("Read the Effect Atom source");
    await page.getByRole("button", { name: "Todo 99" }).click();
    await expect(lookup).toHaveText("There is no todo 99");

    // 03: hiding the report before it finishes interrupts its effect.
    const show = page.getByRole("button", { name: "Show the report" });
    const reportLog = page.getByTestId("report-log");
    await show.click();
    await expect(reportLog).toContainText("effect started");
    await show.click();
    await expect(reportLog).toContainText("effect interrupted");
    await show.click();
    await expect(page.getByTestId("report")).toHaveText(
      "Your report is ready",
      {
        timeout: 6000,
      }
    );

    // 04: the mutation invalidates "todos", so the list and what derives from it follow. The
    // prerendered list is whatever the API held at build time, so the counts start after the
    // refetch, from this test's own store: two seeded todos, one done, and the new one.
    const open = page.getByTestId("home-open");
    await page.getByRole("button", { exact: true, name: "Add" }).click();
    const list = page.getByTestId("home-todos");
    await expect(list).toContainText("Feed the cat");
    await expect(open).toHaveText("2");
    await list.getByRole("checkbox", { name: "Feed the cat" }).check();
    await expect(open).toHaveText("1");
  });

  test("on a phone the landing page's menu opens the sidebar sheet", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 800, width: 390 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Toggle Sidebar" }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("link", { name: "Installation" }).click();
    await expect(page).toHaveURL(/\/installation$/u);
    await expect(sheet).toBeHidden();
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
    const urls = await sitemap.text();
    expect(urls).toContain("<loc>https://atom.jarrednorris.dev/</loc>");
    expect(urls).toContain(
      "<loc>https://atom.jarrednorris.dev/reference/Hooks</loc>"
    );
  });

  test("llms.txt links each page's Markdown, and llms-full.txt has them all", async ({
    request,
  }) => {
    const index = await request.get("/llms.txt");
    expect(index.headers()["content-type"]).toContain("text/plain");
    const indexText = await index.text();
    expect(indexText).toContain(
      "- [Streams](https://atom.jarrednorris.dev/streams.md): "
    );
    expect(indexText).toContain(
      "[Hooks](https://atom.jarrednorris.dev/reference/Hooks.md)"
    );

    // Each linked page is served.
    const pages = await Promise.all(
      [
        "/introduction.md",
        "/streams.md",
        "/reference.md",
        "/reference/Hooks.md",
      ].map((path) => request.get(path))
    );
    expect(pages.map((response) => response.ok())).toEqual([
      true,
      true,
      true,
      true,
    ]);
    const streams = await pages[1]?.text();
    expect(streams).toMatch(/^# Streams\n\n> Follow a Stream's/u);
    // A live example: its hint and a link to try it, then the source of its files.
    expect(streams).toContain(
      "**Live example** ([try it](https://atom.jarrednorris.dev/streams#stream-atoms)): Turn on Reader B"
    );
    expect(streams).toContain("`clock.ts`:\n\n```ts\n");
    expect(streams).toContain(
      "> **Tip: Keep browser-only streams off the server**"
    );

    // The HTML page points to its Markdown.
    const html = await request.get("/streams");
    expect(await html.text()).toContain(
      'href="https://atom.jarrednorris.dev/streams.md" rel="alternate" type="text/markdown"'
    );

    const fullResponse = await request.get("/llms-full.txt");
    const full = await fullResponse.text();
    expect(full).toContain("## About the examples");
    expect(full).toContain("# Streams\n\n> Follow a Stream's");
    expect(full).toContain("export declare function useAtomValue");
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
    // The page's first example; later sections have their own.
    const example = page.locator("[data-example]").first();
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

  test("the theme menu persists the choice and applies it before any app script runs", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/first-atom");
    await page.waitForLoadState("networkidle");
    const html = page.locator("html");
    await expect(html).toHaveClass(/dark/u);
    await page.getByRole("button", { name: "Theme" }).click();
    await page.getByRole("menuitemradio", { name: "Light" }).click();
    await expect(html).not.toHaveClass(/dark/u);
    await expect(html).toHaveAttribute("data-theme", "light");
    // Stored by Atom.kvs, as JSON.
    expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe(
      '"light"'
    );

    // Without the app's JavaScript, only the inline script in app.html can set the class.
    await page.route("**/_app/**/*.js", (route) => route.abort());
    await page.reload();
    await expect(html).not.toHaveClass(/dark/u);
    await expect(
      page.getByRole("button", { name: "Theme" }).locator(".theme-light-icon")
    ).toBeVisible();
  });

  test("System follows the system setting as it changes", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/first-atom");
    await page.waitForLoadState("networkidle");
    const html = page.locator("html");
    await page.getByRole("button", { name: "Theme" }).click();
    await page.getByRole("menuitemradio", { name: "System" }).click();
    await expect(html).not.toHaveClass(/dark/u);
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(html).toHaveClass(/dark/u);
  });

  test("the sound switch persists, and no example plays a note while it is off", async ({
    page,
  }) => {
    // Counts the notes the page starts, since a test can't listen to them.
    await page.addInitScript(() => {
      const counter = window as unknown as { notes: number };
      counter.notes = 0;
      if (!("OscillatorNode" in window)) {
        return;
      }
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
    // Playwright's WebKit on Windows is built without Web Audio, so the examples stay silent there.
    // Safari and Linux WebKit (CI) have it.
    test.skip(
      !(await page.evaluate(() => "AudioContext" in window)),
      "This browser build has no Web Audio"
    );
    const toggle = page.getByRole("button", { name: "Sound effects" });
    const increment = page.getByRole("button", {
      name: "First counter: increment",
    });
    const output = page.locator("[data-example] output").first();
    // Off by default: a click plays nothing, and Tone.js never loads.
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await increment.click();
    await expect(output).toHaveText("1");
    await page.waitForTimeout(200);
    expect(await notes()).toBe(0);
    expect(toneLoads).toBe(0);

    // Turning it on loads Tone.js to play a confirming note (dropped if the download is slow).
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => toneLoads).toBe(1);
    // Building the synths starts notes of its own, so count from just before the click: in
    // Firefox the build once failed after starting some, and every cue was silent.
    await page.waitForTimeout(500);
    const before = await notes();
    await increment.click();
    await expect.poll(notes).toBeGreaterThan(before);
    expect(toneLoads).toBe(1);
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");

    // Turning it off again silences the examples, and that is remembered too.
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await increment.click();
    await expect(output).toHaveText("1");
    await page.waitForTimeout(200);
    expect(await notes()).toBe(0);
    // While sound is off, Tone.js never loads.
    expect(toneLoads).toBe(1);
  });

  test("the sound switch shows on before any app script runs", async ({
    page,
  }) => {
    await page.goto("/first-atom");
    await page.waitForLoadState("networkidle");
    const toggle = page.getByRole("button", { name: "Sound effects" });
    await expect(toggle.locator(".sound-off-icon")).toBeVisible();
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");

    // Without the app's JavaScript, only the inline script in app.html can pick the icon.
    await page.route("**/_app/**/*.js", (route) => route.abort());
    await page.reload();
    await expect(toggle.locator(".sound-on-icon")).toBeVisible();
    await expect(toggle.locator(".sound-off-icon")).toBeHidden();
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

  test("with no stored choice the theme is dark, whatever the system prefers", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("html")).toHaveClass(/dark/u);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
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
