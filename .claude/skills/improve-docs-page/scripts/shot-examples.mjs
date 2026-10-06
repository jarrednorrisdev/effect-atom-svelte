// Screenshots whole examples (result, tabs and shown code) on one page from the dev server, and
// reports console errors. shots.mjs shoots the result alone; use this to judge the shown code.
// Usage (Git Bash, dev running on :5180):
//   MSYS_NO_PATHCONV=1 bun .claude/skills/improve-docs-page/scripts/shot-examples.mjs /page <outPrefix>
//     [--index n] [--click "<button name>"] [--light] [--phone]
// Files are <outPrefix>-<n>.png. --click presses that button inside each example first.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// apps/demo in the checkout or worktree this file sits in.
const require = createRequire(
  fileURLToPath(new URL("../../../../apps/demo/package.json", import.meta.url))
);
const { chromium } = require("@playwright/test");

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const [path, out] = args.filter(
  (a, i) => !a.startsWith("--") && !args[i - 1]?.match(/^--(?:index|click)$/u)
);
if (!path || !out) {
  console.error(
    "usage: shot-examples.mjs /page <outPrefix> [--index n] [--click name] [--light] [--phone]"
  );
  process.exit(1);
}
const theme = flag("--light") ? "light" : "dark";
const viewport = flag("--phone")
  ? { height: 844, width: 390 }
  : { height: 900, width: 1280 };

const browser = await chromium.launch();
const page = await browser.newPage({ colorScheme: theme, viewport });
await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(`http://localhost:5180${path}`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const examples = page.locator("figure[data-example]");
const n = await examples.count();
for (let i = 0; i < n; i += 1) {
  if (value("--index") !== undefined && String(i) !== value("--index")) {
    continue;
  }
  const example = examples.nth(i);
  const click = value("--click");
  if (click) {
    const button = example.getByRole("button", { name: click });
    if (await button.count()) {
      await button.first().click();
    }
    await page.waitForTimeout(400);
  }
  await example.screenshot({ path: `${out}-${i}.png` });
}
console.log(
  path,
  n,
  "examples",
  errors.length ? `errors: ${errors.join(" | ")}` : "no errors"
);
await browser.close();
