// Checks every link to a docs page or section: in the pages' markdown, in vite/api-reference.ts
// (whose guide links fail the build when stale), and in the READMEs that link to the live site.
// Run it after renaming, moving or removing a heading or a page.
// Usage: bun .claude/skills/improve-docs-page/scripts/check-links.mjs
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const repo = "D:/Code/effect-atom-svelte";
const routes = `${repo}/apps/demo/src/routes`;

// rehype-slug's ids (github-slugger): lowercase, punctuation dropped, spaces to hyphens.
const slug = (text) =>
  text
    .replaceAll("`", "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\- _]/gu, "")
    .replaceAll(" ", "-");

const pages = new Map();
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (name === "+page.md") {
      const rel = relative(routes, dir).replaceAll("\\", "/");
      const text = readFileSync(path, "utf8");
      const body = text.replace(/```[\s\S]*?```/gu, "");
      const anchors = new Set([...body.matchAll(/^#{2,4} (.+)$/gmu)].map((m) => slug(m[1])));
      pages.set(rel === "" ? "/" : `/${rel}`, { anchors, text });
    }
  }
};
walk(routes);

let bad = 0;
const check = (from, target, anchor) => {
  if (target.startsWith("/reference")) return;
  const page = pages.get(target);
  if (!page) console.log(`${from}: no page ${target}`);
  else if (anchor && !page.anchors.has(anchor)) console.log(`${from}: no section ${target}#${anchor}`);
  else return;
  bad += 1;
};

for (const [href, { text }] of pages) {
  for (const m of text.matchAll(/\]\((\/[a-z\-/]*)?(?:#([\w-]+))?\)/gu)) {
    if (m[1] || m[2]) check(href, m[1] ?? href, m[2]);
  }
}
const apiReference = readFileSync(`${repo}/apps/demo/vite/api-reference.ts`, "utf8");
for (const m of apiReference.matchAll(/"(\/[a-z-]+)(?:#([\w-]+))?"/gu)) {
  check("vite/api-reference.ts", m[1], m[2]);
}
for (const readme of ["README.md", "packages/effect-atom-svelte/README.md"]) {
  const text = readFileSync(`${repo}/${readme}`, "utf8");
  for (const m of text.matchAll(/atom\.jarrednorris\.dev(\/[a-z\-/]*)?(?:#([\w-]+))?/gu)) {
    if (m[1] && m[1] !== "/") check(readme, m[1].replace(/\/$/u, ""), m[2]);
  }
}
console.log(`${bad} broken link(s)`);
