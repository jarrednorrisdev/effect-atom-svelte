// Lines of code per docs page, to find where code crowds out prose: the example sources a page
// shows (each Example's first tab, which is what opens, and all tabs) and its prose snippets.
// Usage: bun .claude/skills/improve-docs-page/scripts/code-size.mjs
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The docs pages in the checkout or worktree this file sits in.
const routes = fileURLToPath(
  new URL("../../../../apps/demo/src/routes", import.meta.url)
);
const lines = (file) =>
  existsSync(file) ? readFileSync(file, "utf-8").split("\n").length : 0;

const rows = [];
for (const dir of readdirSync(routes)) {
  const md = path.join(routes, dir, "+page.md");
  if (!existsSync(md)) {
    continue;
  }
  const text = readFileSync(md, "utf-8");
  // import xSource from "./x.svelte?highlight"
  const sources = new Map(
    [
      ...text.matchAll(
        /import (?<name>\w+) from "(?<file>\.[^"]+)\?highlight"/gu
      ),
    ].map((m) => [m.groups.name, path.join(routes, dir, m.groups.file)])
  );
  let first = 0;
  let all = 0;
  for (const m of text.matchAll(/<Example files=\{\[(?<files>.*?)\]\}/gu)) {
    const names = [...m.groups.files.matchAll(/html: (?<name>\w+)/gu)].map(
      (n) => n.groups.name
    );
    for (const [i, name] of names.entries()) {
      const n = lines(sources.get(name) ?? "");
      all += n;
      if (i === 0) {
        first += n;
      }
    }
  }
  const snippets = [...text.matchAll(/```\w*\n(?<code>[\s\S]*?)```/gu)];
  const snippetLines = snippets.reduce(
    (sum, m) => sum + m.groups.code.split("\n").length - 1,
    0
  );
  rows.push({ all, dir, first, snippetLines, snippets: snippets.length });
}
rows.sort((a, b) => b.first - a.first);
console.log("page".padEnd(24), "first tabs", "all tabs", "snippets (lines)");
for (const r of rows) {
  console.log(
    r.dir.padEnd(24),
    String(r.first).padStart(10),
    String(r.all).padStart(8),
    `${r.snippets} (${r.snippetLines})`.padStart(17)
  );
}
