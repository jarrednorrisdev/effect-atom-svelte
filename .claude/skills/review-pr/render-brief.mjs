#!/usr/bin/env node
// Fills brief.md for one review round and writes it to .cache/review-brief-<pr>-r<round>.md in this
// checkout. Run it from the PR's worktree, after pushing:
//
//   node render-brief.mjs --pr <n> --round <k> --tier <haiku|sonnet|opus> [--since <sha>] [--full]
//     [--spec <text> | --spec-file <file>] [--notes-file <file>] [--earlier-file <file>] [--context-file <file>]
//
// A round with --since is a delta from that sha, unless --full. It reads the repo's Read commands from
// docs/agents/issue-tracker.md and its checklist from docs/agents/review.md, deletes a stale report at
// the round's report path, and prints the brief's path. The context defaults to the last round's report. Exit codes: 0 written, 1 refused, 2 bad arguments.

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
      ["pr", "round", "tier", "since", "spec", "spec-file", "notes-file", "earlier-file", "context-file"]
        .map((k) => [k, { type: "string" }])
        .concat([["full", { type: "boolean" }]]),
    ),
  }));
} catch (e) {
  console.error(e.message);
  process.exit(2);
}
const { pr, round, tier } = values;
if (!/^\d+$/.test(pr ?? "") || !/^\d+$/.test(round ?? "") || !["haiku", "sonnet", "opus"].includes(tier)) {
  console.error("usage: node render-brief.mjs --pr <n> --round <k> --tier <haiku|sonnet|opus> [--since <sha>] [--full] ...");
  process.exit(2);
}
const refuse = (why) => {
  console.error(`render-brief: ${why}`);
  process.exit(1);
};

const git = (...a) => execFileSync("git", a, { encoding: "utf8" }).trim();
const root = git("rev-parse", "--show-toplevel");
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
const reads = bullets(tracker, String.raw`\*\*Read[^*]*\*\*: `).map((r) => r.replace(/\.$/, "").replaceAll("<n>", pr));
const checklist = bullets(read(path.join(root, "docs/agents/review.md")), "");

// The context the last round's reviewer wrote, from its report's json block.
function lastContext() {
  const prev = read(path.join(root, ".cache", `review-report-${pr}-r${Number(round) - 1}.md`));
  const block = [...prev.matchAll(/```json\s*\n([\s\S]*?)\n```/g)].at(-1);
  try {
    return JSON.parse(block[1]).context || "none";
  } catch {
    return "none";
  }
}

const scope = values.since && !values.full ? "delta" : "full";
const report = path.join(root, ".cache", `review-report-${pr}-r${round}.md`);
const notes = [
  "Skip vendored files, such as the skills synced into `.claude/skills/**`; review only what the repo owns.",
  text(values["notes-file"], ""),
].filter(Boolean).join(" ");

const fill = {
  opening: `${tier[0].toUpperCase()}${tier.slice(1)} tier (claude-${tier}-5-5), ${scope} review.\n\n`,
  pr: `#${pr}`,
  worktree: root,
  read_commands: reads.length ? reads.join("; ") : "see `docs/agents/issue-tracker.md`",
  repo_checklist: checklist.join("\n- "),
  smells_path: path.join(here, "smells.md"),
  since: values.since ?? "",
  report,
  spec: values.spec ?? text(values["spec-file"], "none given: the ticket the PR closes is the spec"),
  notes,
  earlier: text(values["earlier-file"], "none"),
  context: text(values["context-file"], lastContext()),
};

const drop = scope === "full" ? "delta" : "full";
let brief = read(path.join(here, "brief.md"))
  .replace(new RegExp(`<!-- ${drop} -->[\\s\\S]*?<!-- /${drop} -->\\n*`), "")
  .replace(new RegExp(`<!-- /?${scope} -->\\n*`, "g"), "");
if (!checklist.length) brief = brief.replace(/^- \{\{repo_checklist\}\}\n/m, "");
brief = brief.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in fill ? fill[k] : m));
const left = brief.match(/\{\{\w+\}\}/);
if (left) refuse(`brief.md has a placeholder this script doesn't know: ${left[0]}`);

fs.mkdirSync(path.dirname(report), { recursive: true });
fs.rmSync(report, { force: true });
const out = path.join(root, ".cache", `review-brief-${pr}-r${round}.md`);
fs.writeFileSync(out, brief);
console.log(`${scope} review brief: ${out}`);
console.log(`report goes to: ${report}`);
