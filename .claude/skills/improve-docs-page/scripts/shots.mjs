// Screenshots every example (`.demo`) on docs pages from the dev server.
// Usage (Git Bash, dev running on :5180):
//   MSYS_NO_PATHCONV=1 bun .claude/skills/improve-docs-page/scripts/shots.mjs <outDir> [/page,/page] [--light] [--phone]
// Files are named <page>-<n>.png. Without a page list it shoots every non-reference page.
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

// apps/demo in the checkout or worktree this file sits in.
const demo = fileURLToPath(new URL("../../../../apps/demo/", import.meta.url));
const require = createRequire(`${demo}package.json`);
const { chromium } = require("@playwright/test");

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const [out, list] = args.filter((a) => !a.startsWith("--"));
if (!out) {
  console.error("usage: shots.mjs <outDir> [/page,/page] [--light] [--phone]");
  process.exit(1);
}
const only = list?.split(",");
const theme = flags.has("--light") ? "light" : "dark";
const viewport = flags.has("--phone")
  ? { height: 844, width: 390 }
  : { height: 900, width: 1280 };

mkdirSync(out, { recursive: true });
const { nav } = await import(pathToFileURL(`${demo}src/lib/docs/nav.ts`).href);
const pages = nav
  .flatMap((s) => s.pages.map((p) => p.href))
  .filter((h) => !h.startsWith("/reference"))
  .filter((h) => !only || only.includes(h));

const browser = await chromium.launch();
const page = await browser.newPage({ colorScheme: theme, viewport });
await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
page.on("pageerror", (error) => console.log("pageerror", error.message));
for (const href of pages) {
  await page.goto(`http://localhost:5180${href}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const demos = page.locator(".demo");
  const n = await demos.count();
  const name = href === "/" ? "index" : href.slice(1).replaceAll("/", "_");
  for (let i = 0; i < n; i += 1) {
    await demos
      .nth(i)
      .screenshot({ path: `${out}/${name}-${i}.png` })
      .catch((error) => console.log(href, i, error.message));
  }
  console.log(href, n);
}
await browser.close();
