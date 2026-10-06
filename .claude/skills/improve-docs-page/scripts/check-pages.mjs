// Loads every page in the sidebar (API reference included) from the dev server and reports the
// status, console errors, and on a phone what sticks out past the screen.
// Usage (Git Bash, dev running on :5180):
//   MSYS_NO_PATHCONV=1 bun .claude/skills/improve-docs-page/scripts/check-pages.mjs [--phone] [--light] [/page,/page]
// Prints only problems, then a count. A page is "wide" when the document scrolls sideways; the
// elements listed are the outermost ones past the edge that no scroller contains.
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const demo = "D:/Code/effect-atom-svelte/apps/demo";
const require = createRequire(`${demo}/package.json`);
const { chromium } = require("@playwright/test");
const { pages } = await import(pathToFileURL(`${demo}/src/lib/docs/nav.ts`).href);

const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith("/"))?.split(",");
const phone = args.includes("--phone");
const browser = await chromium.launch();
const page = await browser.newPage({
  colorScheme: args.includes("--light") ? "light" : "dark",
  viewport: phone ? { height: 844, width: 390 } : { height: 900, width: 1280 },
});

let problems = 0;
for (const { href } of pages.filter((p) => !only || only.includes(p.href))) {
  const errors = [];
  const onError = (e) => errors.push(e.message);
  const onConsole = (m) => m.type() === "error" && errors.push(m.text());
  page.on("pageerror", onError);
  page.on("console", onConsole);
  const response = await page.goto(`http://localhost:5180${href}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const wide = await page.evaluate(() => {
    if (document.documentElement.scrollWidth <= window.innerWidth + 1) return [];
    const scrolls = (el) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        if (["auto", "scroll", "hidden", "clip"].includes(getComputedStyle(p).overflowX)) return true;
      }
      return false;
    };
    return [...document.querySelectorAll("body *")]
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1 && !scrolls(el))
      .filter((el, _, all) => !all.includes(el.parentElement))
      .slice(0, 4)
      .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 2).join(".")} "${(el.textContent ?? "").trim().slice(0, 40)}"`);
  });
  page.off("pageerror", onError);
  page.off("console", onConsole);
  if (response?.status() !== 200 || errors.length || wide.length) {
    problems += 1;
    console.log(href, response?.status(), errors.length ? `errors: ${errors.join(" | ").slice(0, 300)}` : "", wide.length ? `wide: ${wide.join("; ")}` : "");
  }
}
console.log(`${problems} page(s) with problems`);
await browser.close();
