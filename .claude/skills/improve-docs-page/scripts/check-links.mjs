// Checks every link to a docs page or section: in the pages' markdown, in vite/api-reference.ts
// (whose guide links fail the build when stale), and in the READMEs that link to the live site.
// Run it after renaming, moving or removing a heading or a page.
// Usage: bun .claude/skills/improve-docs-page/scripts/check-links.mjs
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The repo root, four levels up from this file, so the checkout or worktree it sits in is checked.
const repo = fileURLToPath(new URL("../../../../", import.meta.url));
const routes = path.join(repo, "apps/demo/src/routes");

// rehype-slug's ids (github-slugger): lowercase, punctuation dropped, spaces to hyphens.
const slug = (text) =>
  text
    .replaceAll("`", "")
    .trim()
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}\- _]/gu, "")
    .replaceAll(" ", "-");

const pages = new Map();
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) {
      walk(file);
    } else if (name === "+page.md") {
      const rel = path.relative(routes, dir).replaceAll("\\", "/");
      const text = readFileSync(file, "utf-8");
      const body = text.replaceAll(/```[\s\S]*?```/gu, "");
      const anchors = new Set(
        [...body.matchAll(/^#{2,4} (?<heading>.+)$/gmu)].map((m) =>
          slug(m.groups.heading)
        )
      );
      pages.set(rel === "" ? "/" : `/${rel}`, { anchors, text });
    }
  }
};
walk(routes);

let bad = 0;
const check = (from, target, anchor) => {
  if (target.startsWith("/reference")) {
    return;
  }
  const page = pages.get(target);
  if (!page) {
    console.log(`${from}: no page ${target}`);
  } else if (anchor && !page.anchors.has(anchor)) {
    console.log(`${from}: no section ${target}#${anchor}`);
  } else {
    return;
  }
  bad += 1;
};

for (const [href, { text }] of pages) {
  for (const m of text.matchAll(
    /\]\((?<target>\/[a-z\-/]*)?(?:#(?<anchor>[\w-]+))?\)/gu
  )) {
    const { anchor, target } = m.groups;
    if (target || anchor) {
      check(href, target ?? href, anchor);
    }
  }
}
const apiReference = readFileSync(
  path.join(repo, "apps/demo/vite/api-reference.ts"),
  "utf-8"
);
for (const m of apiReference.matchAll(
  /"(?<target>\/[a-z-]+)(?:#(?<anchor>[\w-]+))?"/gu
)) {
  check("vite/api-reference.ts", m.groups.target, m.groups.anchor);
}
for (const readme of ["README.md", "packages/effect-atom-svelte/README.md"]) {
  const text = readFileSync(path.join(repo, readme), "utf-8");
  for (const m of text.matchAll(
    /atom\.jarrednorris\.dev(?<target>\/[a-z\-/]*)?(?:#(?<anchor>[\w-]+))?/gu
  )) {
    const { anchor, target } = m.groups;
    if (target && target !== "/") {
      check(readme, target.replace(/\/$/u, ""), anchor);
    }
  }
}
console.log(`${bad} broken link(s)`);
