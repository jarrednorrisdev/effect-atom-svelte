#!/usr/bin/env node
// Renders the PR's review comment (comment.md's shape) from a reviewer's report and every round's
// Fixed rows, and writes it to .cache/review-comment-<pr>.md in this checkout. Run it from the PR's
// worktree:
//
//   node render-comment.mjs --pr <n> --round <k> --report <file> --tier <tier> --reason "<tier reason>"
//     [--effort <effort>] [--fixed <file>] [--verdict "<line>"]
//
// --fixed is a JSON array of every round's rows: {"round", "axis", "finding", "resolution", "nit"?}.
// --verdict replaces the reviewer's verdict, e.g. to name fixes no reviewer has checked.
// Prints the comment's path; post it as comment.md says. Exit codes: 0 written, 1 refused, 2 bad arguments.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

let values;
try {
  ({ values } = parseArgs({
    options: Object.fromEntries(["pr", "round", "report", "tier", "reason", "effort", "fixed", "verdict"].map((k) => [k, { type: "string" }])),
  }));
} catch (e) {
  console.error(e.message);
  process.exit(2);
}
const { pr, round, tier, reason } = values;
if (!/^\d+$/.test(pr ?? "") || !/^\d+$/.test(round ?? "") || !values.report || !tier || !reason) {
  console.error('usage: node render-comment.mjs --pr <n> --round <k> --report <file> --tier <tier> --reason "<why>" [--effort <e>] [--fixed <file>] [--verdict "<line>"]');
  process.exit(2);
}
const refuse = (why) => {
  console.error(`render-comment: ${why}`);
  process.exit(1);
};

const blocks = [...fs.readFileSync(values.report, "utf8").matchAll(/```json\s*\n([\s\S]*?)\n```/g)];
if (!blocks.length) refuse(`no json block in ${values.report}`);
let r;
try {
  r = JSON.parse(blocks.at(-1)[1]);
} catch (e) {
  refuse(`the report's last json block doesn't parse: ${e.message}`);
}
const fixed = values.fixed ? JSON.parse(fs.readFileSync(values.fixed, "utf8")) : [];

const git = (...a) => execFileSync("git", a, { encoding: "utf8" }).trim();
const root = git("rev-parse", "--show-toplevel");
// A link to path:line at the sha the reviewer read, on GitHub or Forgejo.
const remote = git("remote", "get-url", "origin").replace(/\.git$/, "").replace(/^git@([^:]+):/, "https://$1/");
const web = remote.replace(/^ssh:\/\/git@([^/]+)\//, "https://$1/");
const link = (p, line) => `${web}/${web.includes("github.com") ? "blob" : "src/commit"}/${r.sha}/${p}#L${line}`;

const cell = (s) => String(s ?? "").replaceAll("|", "\\|").replace(/\s*\n\s*/g, " ");
const num = (s) => (s === "n/a" ? 5 : Number(s));
const dot = (s) => (s === "n/a" ? "⚪" : { 5: "🟢", 4: "🟡", 3: "🟠" }[s] ?? "🔴");
const axes = ["Spec", "Design", "Implementation", "Stability", "Security"];
const subs = axes.map((a) => [a, r.subscores?.[a] ?? refuse(`the report has no ${a} subscore`)]);
const score = Math.min(...subs.map(([, s]) => num(s.score)));
const toReach = subs.some(([, s]) => num(s.score) < 5);

const out = ["<!-- review-pr -->", "", `## Confidence Score: ${score}/5`, "", `**[${r.impact} impact]** ${values.verdict ?? r.verdict}`, ""];
out.push(toReach ? "| Subscore | Score | Why | To reach 5 |" : "| Subscore | Score | Why |");
out.push(toReach ? "| --- | --- | --- | --- |" : "| --- | --- | --- |");
for (const [a, s] of subs) {
  const row = [a, `${dot(s.score)} ${s.score}`, cell(s.why)];
  if (toReach) row.push(num(s.score) < 5 ? cell(s.toReach) : "");
  out.push(`| ${row.join(" | ")} |`);
}
const decisions = r.decisions ?? [];
if (decisions.length) {
  out.push("", "### Decisions", "");
  decisions.forEach((d, i) =>
    out.push(`${i + 1}. **${d.finding}** (${d.axis}, [\`${d.path}:${d.line}\`](${link(d.path, d.line)})): ${d.options}. Recommended: ${d.recommended}.`),
  );
}
const summary = [r.summary ?? []].flat().filter(Boolean);
if (summary.length) out.push("", "### Summary", "", ...summary.map((s) => (s.startsWith("- ") ? s : `- ${s}`)));
if (fixed.length) {
  out.push("", "<details>", `<summary>Fixed (${fixed.length})</summary>`, "", "| Round | Axis | Finding | Resolution |", "| --- | --- | --- | --- |");
  for (const f of fixed) out.push(`| ${f.round} | ${f.axis} | ${f.nit ? "(nit) " : ""}${cell(f.finding)} | ${cell(f.resolution)} |`);
  out.push("", "</details>");
}
const model = `claude-${tier.toLowerCase()}-5-5`;
out.push("", `<sub>Round ${round} · ${tier[0].toUpperCase()}${tier.slice(1)} (${model}, ${values.effort ?? "default effort"}): ${reason} · reviewed at ${r.sha.slice(0, 7)}</sub>`);
const state = { round: Number(round), sha: r.sha, tier, context: r.context ?? "", open: decisions.map((d) => d.finding) };
out.push("", `<!-- review-pr-state: ${JSON.stringify(state).replaceAll("--", "- -")} -->`, "");

const file = path.join(root, ".cache", `review-comment-${pr}.md`);
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, out.join("\n"));
console.log(`score ${score}/5, ${decisions.length} open decisions: ${file}`);
