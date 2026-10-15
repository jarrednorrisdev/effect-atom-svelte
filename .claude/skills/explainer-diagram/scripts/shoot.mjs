// Screenshots a built diagram, in dark mode, and reports console errors.
//
//   cd <a checkout's>/packages/effect-atom-svelte   # Playwright resolves from here
//   node <skill>/scripts/shoot.mjs <diagram.html> <out-dir> [--key before-10,after-10]
//
// Writes <out-dir>/<mode>-<step>.png (900 px) for every step and <out-dir>/phone.png (390 px) for
// the first. --key also writes <out-dir>/key-<mode>-<step>.png for each listed step: just the
// diagram (?capture), at 2x, for a PR description. Exits 1 if any page logged an error.
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(`${process.cwd()}/`)("playwright");
const args = process.argv.slice(2);
const keyAt = args.indexOf("--key");
const keys = keyAt === -1 ? [] : args.splice(keyAt, 2)[1].split(",");
const [file, outDir] = args;
if (!file || !outDir) {
  console.error("usage: node shoot.mjs <diagram.html> <out-dir> [--key before-10,after-10]");
  process.exit(2);
}
const url = `file://${resolve(file)}`;
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const errors = [];
const shoot = async (query, hash, path, { width = 900, scale = 1 } = {}) => {
  const page = await browser.newPage({
    viewport: { width, height: 900 },
    deviceScaleFactor: scale,
    colorScheme: "dark",
  });
  page.on("pageerror", (e) => errors.push(`${hash}: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${hash}: ${m.text()}`));
  await page.goto(`${url}${query}#${hash}`);
  // Lets the step's transitions, and the packet's trip, finish.
  await page.waitForTimeout(1800);
  const info = await page.evaluate(() => ({ count: window.stepper.count(), hasAfter: window.stepper.hasAfter }));
  if (path) await page.screenshot({ path, fullPage: true });
  await page.close();
  return info;
};

const { count, hasAfter } = await shoot("", "before-1", `${outDir}/phone.png`, { width: 390 });
for (const mode of hasAfter ? ["before", "after"] : ["before"]) {
  for (let n = 1; n <= count; n++) await shoot("", `${mode}-${n}`, `${outDir}/${mode}-${n}.png`);
}
for (const key of keys) await shoot("?capture", key, `${outDir}/key-${key}.png`, { scale: 2 });
await browser.close();

console.log(`shots in ${outDir}`);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("no console errors");
