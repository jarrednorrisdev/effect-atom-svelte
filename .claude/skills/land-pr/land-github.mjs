#!/usr/bin/env node
// A GitHub repo's Land command: merges origin/main into the PR's branch, runs the landing check on
// that tree, pushes, and merges the PR only when the check passes, by a merge commit where the repo
// allows one, else by squash. Run it from the PR's own worktree, through the lock:
//
//   node land-lock.mjs --pr <n> -- node land-github.mjs <n> -- "<check>" ["<check>"...]
//
// Each quoted check after `--` is one shell command, run in order (e.g. "cargo check --workspace"
// "cargo test -p shared"). Exit codes: 0 landed (or already merged), 1 refused (the reason is
// printed), 2 bad arguments.

import { execFileSync, spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const [pr, dash, ...checks] = args;
if (!/^\d+$/.test(pr ?? "") || dash !== "--" || checks.length === 0) {
  console.error('usage: node land-github.mjs <pr> -- "<check>" ["<check>"...]');
  process.exit(2);
}

const out = (cmd, ...a) => execFileSync(cmd, a, { encoding: "utf8" }).trim();
const run = (cmd, ...a) => {
  console.log(`$ ${[cmd, ...a].join(" ")}`);
  return spawnSync(cmd, a, { stdio: "inherit" }).status === 0;
};
const refuse = (why) => {
  console.error(`land: refused: ${why}`);
  process.exit(1);
};

let view;
try {
  view = JSON.parse(out("gh", "pr", "view", pr, "--json", "state,isDraft,headRefName,baseRefName,mergeCommit"));
} catch {
  refuse(`gh pr view ${pr} failed (no such PR, or gh isn't logged in)`);
}
if (view.state === "MERGED") {
  console.log(`land: PR #${pr} already merged at ${view.mergeCommit?.oid ?? "?"}`);
  process.exit(0);
}
if (view.state !== "OPEN") refuse(`PR #${pr} is ${view.state}`);
if (view.isDraft) refuse(`PR #${pr} is a draft; mark it ready first (gh pr ready ${pr})`);
if (view.baseRefName !== "main") refuse(`PR #${pr} targets ${view.baseRefName}, not main`);
const branch = out("git", "branch", "--show-current");
if (branch !== view.headRefName) refuse(`this worktree is on ${branch}, PR #${pr} is ${view.headRefName}`);
if (out("git", "status", "--porcelain", "--untracked-files=no")) refuse("the worktree has uncommitted changes");

if (!run("git", "fetch", "origin")) refuse("git fetch failed");
if (!run("git", "merge", "--no-edit", "origin/main")) refuse("merging origin/main conflicts; the conflict is left in the tree");
for (const check of checks) {
  console.log(`$ ${check}`);
  if (spawnSync(check, { stdio: "inherit", shell: true }).status !== 0) refuse(`${check} failed`);
}

const head = out("git", "rev-parse", "HEAD");
if (!run("git", "push", "origin", `HEAD:${branch}`)) refuse("git push failed");
const allowed = JSON.parse(out("gh", "repo", "view", "--json", "mergeCommitAllowed"));
const method = allowed.mergeCommitAllowed ? "--merge" : "--squash";
if (!run("gh", "pr", "merge", pr, method, "--match-head-commit", head)) refuse("gh pr merge failed");
console.log(`land: PR #${pr} merged (head ${head.slice(0, 7)})`);
