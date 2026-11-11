#!/usr/bin/env node
// A Forgejo repo's Land command: merges origin/main into the PR's branch, runs the landing check on
// that tree, pushes, and merges the PR only when the check passes, by the repo's default merge style.
// Run it from the PR's own worktree, through the lock, with `tea` logged in:
//
//   node land-lock.mjs --pr <n> -- node land-forgejo.mjs <n> -- "<check>" ["<check>"...]
//
// Each quoted check after `--` is one shell command, run in order (e.g. "just check").
// Exit codes: 0 landed (or already merged), 1 refused (the reason is printed), 2 bad arguments.

import { execFileSync, spawnSync } from "node:child_process";

const [pr, dash, ...checks] = process.argv.slice(2);
if (!/^\d+$/.test(pr ?? "") || dash !== "--" || checks.length === 0) {
  console.error('usage: node land-forgejo.mjs <pr> -- "<check>" ["<check>"...]');
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
// tea api exits 0 on an HTTP error, so read the status line it writes to stderr with -i.
const api = (path, ...a) => {
  const r = spawnSync("tea", ["api", "-i", ...a, path ? `repos/{owner}/{repo}/${path}` : "repos/{owner}/{repo}"], { encoding: "utf8" });
  const status = Number(r.stderr?.match(/^HTTP\/\S+ (\d+)/m)?.[1] ?? 0);
  return { ok: status >= 200 && status < 300, status, body: r.stdout?.trim() ? JSON.parse(r.stdout) : null };
};

const view = api(`pulls/${pr}`);
if (!view.ok) refuse(`tea api pulls/${pr} returned ${view.status || "nothing"} (no such PR, or tea isn't logged in)`);
const p = view.body;
if (p.merged) {
  console.log(`land: PR #${pr} already merged at ${p.merge_commit_sha}`);
  process.exit(0);
}
if (p.state !== "open") refuse(`PR #${pr} is ${p.state}`);
if (p.draft) refuse(`PR #${pr} is a draft; drop the WIP: from its title first`);
if (p.base.ref !== "main") refuse(`PR #${pr} targets ${p.base.ref}, not main`);
const branch = out("git", "branch", "--show-current");
if (branch !== p.head.ref) refuse(`this worktree is on ${branch}, PR #${pr} is ${p.head.ref}`);
if (out("git", "status", "--porcelain", "--untracked-files=no")) refuse("the worktree has uncommitted changes");

if (!run("git", "fetch", "origin")) refuse("git fetch failed");
if (!run("git", "merge", "--no-edit", "origin/main")) refuse("merging origin/main conflicts; the conflict is left in the tree");
for (const check of checks) {
  console.log(`$ ${check}`);
  if (spawnSync(check, { stdio: "inherit", shell: true }).status !== 0) refuse(`${check} failed`);
}

const head = out("git", "rev-parse", "HEAD");
if (!run("git", "push", "origin", `HEAD:${branch}`)) refuse("git push failed");
const style = api("").body?.default_merge_style ?? "merge";
const merged = api(`pulls/${pr}/merge`, "-d", JSON.stringify({ Do: style, head_commit_id: head }));
if (!merged.ok) refuse(`the merge returned ${merged.status}: ${merged.body?.message ?? ""}`);
console.log(`land: PR #${pr} merged (head ${head.slice(0, 7)}, ${style})`);
