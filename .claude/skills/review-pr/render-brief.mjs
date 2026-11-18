#!/usr/bin/env node
// Fills brief.md for one review round and writes it to .cache/review-brief-<key>-r<round>.md in this
// checkout, where <key> is the PR number, or branch-<branch> for a branch with no PR. Run it from the
// PR's worktree, after pushing:
//
//   node render-brief.mjs [--pr <n>] --round <k> --tier <tier> [--since <sha>] [--full] [--base <branch>]
//     [--extra-diff <file>] [--spec <text> | --spec-file <file>] [--notes-file <file>] [--earlier-file <file>]
//     [--context-file <file>]
//
// <tier> is a tier name from wayfinder's tiers.md (opus, opus-low, sonnet, sonnet-low, haiku), or a model
// with an effort (opus-medium). A round with --since is a delta from that sha, unless --full. --base is the
// branch the work merges into (main by default; in ship fast, a ticket's release branch). --extra-diff names a
// diff that ships with this work but isn't in it, such as another repo's half; the reviewer reviews it too.
// It reads the repo's Read commands from docs/agents/issue-tracker.md and its checklist from
// docs/agents/review.md, keeps the brief's ship-fast block unless docs/agents/ship-mode.md says
// `mode: properly`, deletes a stale report at the round's report path, and prints the brief's path. The
// context defaults to the last round's report. From round 2 it needs the earlier findings: --earlier-file,
// or the Fixed rows in .cache/review-fixed-<key>.json. Exit codes: 0 written, 1 refused, 2 bad arguments.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const here = path.dirname(fileURLToPath(import.meta.url));
let values;
try {
  ({ values } = parseArgs({
    options: Object.fromEntries(
      ["pr", "round", "tier", "base", "since", "extra-diff", "spec", "spec-file", "notes-file", "earlier-file", "context-file"]
        .map((k) => [k, { type: "string" }])
        .concat([["full", { type: "boolean" }]]),
    ),
  }));
} catch (e) {
  console.error(e.message);
  process.exit(2);
}
const { pr, round, tier } = values;
const base = values.base ?? "main";
// tiers.md names a tier by model and optional effort; with no effort, haiku runs high and the rest medium.
const tierMatch = /^(opus|sonnet|haiku)(?:-(low|medium|high))?$/.exec(tier ?? "");
if ((pr !== undefined && !/^\d+$/.test(pr)) || !/^\d+$/.test(round ?? "") || !tierMatch || !/^\w[\w./-]*$/.test(base)) {
  console.error(
    "usage: node render-brief.mjs [--pr <n>] --round <k> --tier <opus|opus-low|sonnet|sonnet-low|haiku> [--since <sha>] [--full] [--base <branch>] [--extra-diff <file>] ...",
  );
  process.exit(2);
}
const [, model, effort = model === "haiku" ? "high" : "medium"] = tierMatch;
const refuse = (why) => {
  console.error(`render-brief: ${why}`);
  process.exit(1);
};

const git = (...a) => execFileSync("git", a, { encoding: "utf8" }).trim();
const branch = git("rev-parse", "--abbrev-ref", "HEAD");
// Names this review's files: the PR number, or the branch when there is no PR.
const key = pr ?? `branch-${branch.replace(/[^\w.-]+/g, "-")}`;
// The on-disk spelling: a shell can start in a differently cased path on Windows.
const root = fs.realpathSync.native(git("rev-parse", "--show-toplevel"));
if (git("status", "--porcelain", "--untracked-files=no")) refuse("the checkout has uncommitted changes: commit and push first, so the reviewer reads what you pushed");
let upstream = "";
try {
  upstream = git("rev-parse", "@{u}");
} catch {
  refuse("the branch has no upstream: push it first");
}
if (git("rev-parse", "HEAD") !== upstream) refuse("HEAD isn't the pushed head: push first");

const read = (file) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "");
const text = (file, fallback) => (file ? read(file).trim() || fallback : fallback);

const tracker = read(path.join(root, "docs/agents/issue-tracker.md"));
// A bullet with its wrapped continuation lines, joined onto one line.
const bullets = (doc, lead) =>
  [...doc.matchAll(new RegExp(String.raw`^- ${lead}(.+(?:\r?\n {2,}.+)*)`, "gm"))].map((m) => m[1].replace(/\s+/g, " ").trim());
const reads = bullets(tracker, String.raw`\*\*Read[^*]*\*\*: `).map((r) => r.replace(/\.$/, "").replaceAll("<n>", pr ?? "<n>"));
// A missing ship-mode.md means ship fast.
const fast = !/^mode:\s*properly\b/m.test(read(path.join(root, "docs/agents/ship-mode.md")));
const checklist = bullets(read(path.join(root, "docs/agents/review.md")), "");

// The context the last round's reviewer wrote, from its report's json block.
function lastContext() {
  const prev = read(path.join(root, ".cache", `review-report-${key}-r${Number(round) - 1}.md`));
  const block = [...prev.matchAll(/```json\s*\n([\s\S]*?)\n```/g)].at(-1);
  try {
    return JSON.parse(block[1]).context || "none";
  } catch {
    return "none";
  }
}

// Round 2 and later hand the reviewer the earlier rounds' findings and the author's responses: from
// --earlier-file, else from the Fixed rows kept in .cache/review-fixed-<pr>.json (`[]` says none were raised).
// With neither, the brief would read "Earlier rounds: none", so refuse.
function earlierRounds() {
  const given = text(values["earlier-file"], "");
  if (given) return given;
  if (Number(round) <= 1) return "none";
  const rowsFile = path.join(root, ".cache", `review-fixed-${key}.json`);
  if (!fs.existsSync(rowsFile)) {
    refuse(
      `round ${round} needs round ${Number(round) - 1}'s findings and none were given: pass --earlier-file <file> with them, or write the Fixed rows as a JSON array to .cache/review-fixed-${key}.json (\`[]\` says none were raised)`,
    );
  }
  let rows;
  try {
    rows = JSON.parse(fs.readFileSync(rowsFile, "utf8"));
    if (!Array.isArray(rows)) throw new Error("not an array");
  } catch (e) {
    return refuse(`${rowsFile} isn't a JSON array of Fixed rows: ${e.message}`);
  }
  if (!rows.length) return "No finding has been raised and resolved yet.";
  const cell = (s) => String(s ?? "").replaceAll("|", String.raw`\|`).replace(/\s*\n\s*/g, " ");
  return [
    "Findings and the author's responses:",
    "",
    "| Round | Axis | Finding | Resolution |",
    "| --- | --- | --- | --- |",
    ...rows.map((r) => `| ${cell(r.round)} | ${cell(r.axis)} | ${cell(r.nit && !/^\(nit\)/.test(r.finding) ? `(nit) ${r.finding}` : r.finding)} | ${cell(r.resolution)} |`),
  ].join("\n");
}

// A companion diff, such as another repo's half of this change, reviewed with it.
let extraDiff = "";
if (values["extra-diff"]) {
  const file = path.resolve(values["extra-diff"]);
  if (!fs.existsSync(file)) refuse(`--extra-diff ${file} doesn't exist`);
  extraDiff = file;
}

const scope = values.since && !values.full ? "delta" : "full";
const report = path.join(root, ".cache", `review-report-${key}-r${round}.md`);
const notes = [
  "Skip vendored files, such as the skills synced into `.claude/skills/**`; review only what the repo owns.",
  text(values["notes-file"], ""),
].filter(Boolean).join(" ");

const fill = {
  opening: `${tier[0].toUpperCase()}${tier.slice(1)} tier (claude-${model}-5-5, ${effort} effort), ${scope} review.\n\n`,
  pr: pr ? `PR #${pr}` : `branch \`${branch}\` (it has no PR: read "the PR" below as this branch)`,
  extra_diff: extraDiff,
  base,
  worktree: root,
  read_commands: reads.length ? reads.join("; ") : "see `docs/agents/issue-tracker.md`",
  repo_checklist: checklist.join("\n- "),
  smells_path: path.join(here, "smells.md"),
  since: values.since ?? "",
  report,
  spec: values.spec ?? text(values["spec-file"], "none given: the ticket the PR closes is the spec"),
  notes,
  earlier: earlierRounds(),
  context: text(values["context-file"], lastContext()),
};

const drop = scope === "full" ? "delta" : "full";
let brief = read(path.join(here, "brief.md"))
  .replace(new RegExp(`<!-- ${drop} -->[\\s\\S]*?<!-- /${drop} -->\\n*`), "")
  .replace(new RegExp(`<!-- /?${scope} -->\\n*`, "g"), "")
  .replace(fast ? /<!-- \/?fast -->\n*/g : /<!-- fast -->[\s\S]*?<!-- \/fast -->\n*/, "");
if (!checklist.length) brief = brief.replace(/^- \{\{repo_checklist\}\}\n/m, "");
brief = extraDiff ? brief.replace(/<!-- \/?extra -->\n*/g, "") : brief.replace(/<!-- extra -->[\s\S]*?<!-- \/extra -->\n*/, "");
brief = brief.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in fill ? fill[k] : m));
const left = brief.match(/\{\{\w+\}\}/);
if (left) refuse(`brief.md has a placeholder this script doesn't know: ${left[0]}`);

fs.mkdirSync(path.dirname(report), { recursive: true });
fs.rmSync(report, { force: true });
const out = path.join(root, ".cache", `review-brief-${key}-r${round}.md`);
fs.writeFileSync(out, brief);
console.log(`${scope} review brief${fast ? " (ship fast)" : ""}: ${out}`);
console.log(`report goes to: ${report}`);
