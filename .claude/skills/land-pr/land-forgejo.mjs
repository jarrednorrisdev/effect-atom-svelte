#!/usr/bin/env node
// A Forgejo repo's Land command: merges origin/main into the PR's branch, runs the landing check on
// that tree, pushes, and merges the PR only when the check passes, by the repo's default merge style.
// Run it from the PR's own worktree, through the lock, with `tea` logged in:
//
//   node land-lock.mjs --pr <n> -- node land-forgejo.mjs <n> -- "<check>" ["<check>"...]
//
// Each quoted check after `--` is one shell command, run in order (e.g. "just check").
// Exit codes: 0 landed (or already merged), 1 refused (the reason is printed), 2 bad arguments.
// Forgejo has the last word (#1774): an error after a confirmed merge is a warning and exits 0.
//
// Generated files: set LAND_REGEN_PATHS (space-separated path prefixes, e.g. "openapi.yaml
// web/src/lib/api/") and LAND_REGEN_CMD (e.g. "just gen"). When merging origin/main conflicts only
// in files under those prefixes, the script takes main's side, runs the command to regenerate them
// from the merged sources, commits the merge and goes on to the checks. Any other conflict refuses.
// More pairs: LAND_REGEN_PATHS_<NAME> with LAND_REGEN_CMD_<NAME> (e.g. _SKILLS for a skills lock).
// Every conflicted file must fall under some pair; only the pairs that cover one run, in name order.
//
// Hooks: shell commands the Land command sets, each run in the PR's worktree. LAND_PREPARE_CMD runs
// after the merge of origin/main (or, in a batch, of the batch so far) and before the checks, with
// LAND_PREPARE_BASE set to the commit it merged in; whatever it commits is part of the head that
// is checked, pushed and merged (e.g. renumbering the branch's migrations past main's). It must
// leave no uncommitted change. A failure refuses the landing, the tree put back on the merge (in a
// batch, the member leaves it). With it set, the single path merges origin/main pinned to the sha
// it hands the hook. Unset, nothing changes.
//
// LAND_AFTER_CMD runs once at the end of a run that merged at least one PR, in this script's own
// worktree, with LAND_AFTER_PRS set to the PRs this run merged (space-separated, in merge order)
// and LAND_AFTER_MAIN to origin/main after them (lexicontent #1768: relays to the threads that
// care, so none waits on a watchdog). A PR found already merged isn't in the list. It is best
// effort: the PRs are merged already, so its failure is printed and never changes the exit code.
// It runs under the lock, so it is killed after LAND_AFTER_TIMEOUT_S (default 300) seconds. In a
// batch it is the holder's, and every member's LAND_* settings match already. Unset, nothing changes.
//
// Batches (D294): run through land-lock, which passes JND_LAND_WAITERS_DIR and JND_LAND_TOKEN, the
// holder lands up to JND_LAND_BATCH_MAX (default 3; 1 turns it off) PRs on one check run. It claims
// waiting landings of this script whose checks are a subset of its own and whose LAND_* settings
// other than LAND_REGEN_* match; only those that answer the claim join. The chain is the waiters in
// queue order, then the holder: B1 = origin/main merged into the first, each next one merges the
// previous B, and the checks run once on the last, in the holder's worktree. Then each B_k is
// pushed and merged, pinned to its head, in order, so main ends on the checked tree. A failed
// check, a member killed before the first push, or a chain that can't be built lands every member
// one at a time instead, through the single path. JND_LAND_TEA (a JSON argv) replaces `tea`.
//
// Culprits (D1763): set LAND_CULPRIT_CMD to a repo hook, and a failed run asks it whose failure it
// was. The hook is run in the checked tree as `<cmd> "<input.json>"`. The input holds the failed
// check, that run's log, the base and each member's PR, worktree, head and changed files. It prints
// JSON `{"infra": "<why>"|null, "failures": [{"name", "suspects": ["<pr>"], "flaky": bool}]}`.
// A run whose failures are all infrastructure or known-flaky runs once more. Otherwise, when every
// other failure has a suspect and not every member is one, the suspects leave with exit 1 and the
// rest is rebuilt and checked once; else the batch splits in halves, the holder's half first. A
// rest or half that fails again and names its culprit the same way drops it with no run of its
// own and checks what is left as one batch (#1834); one whose failure names no culprit, or every
// member, lands each member alone (one member: refused). Without the hook a failed batch lands
// every member alone, as before. Every check run's output is also kept in
// jnd-land-runs/ beside the land log, and a PR that leaves a batch or fails gets a `land:` comment.

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const [pr, dash, ...checks] = process.argv.slice(2);
if (!/^\d+$/.test(pr ?? "") || dash !== "--" || checks.length === 0) {
  console.error('usage: node land-forgejo.mjs <pr> -- "<check>" ["<check>"...]');
  process.exit(2);
}

class Refused extends Error {}
const refuse = (why) => {
  throw new Refused(why);
};
const sleep = (s) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, s * 1000);
const here = process.cwd();
const git = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8" }).trim();
const run = (cwd, cmd, ...a) => {
  console.log(`$ ${[cmd, ...a].join(" ")}${cwd === here ? "" : `  (in ${cwd})`}`);
  return spawnSync(cmd, a, { cwd, stdio: "inherit" }).status === 0;
};
const tea = process.env.JND_LAND_TEA ? JSON.parse(process.env.JND_LAND_TEA) : ["tea"];
// tea api exits 0 on an HTTP error, so read the status line it writes to stderr with -i.
const api = (p, ...a) => {
  const r = spawnSync(tea[0], [...tea.slice(1), "api", "-i", ...a, p ? `repos/{owner}/{repo}/${p}` : "repos/{owner}/{repo}"], {
    encoding: "utf8",
  });
  const status = Number(r.stderr?.match(/^HTTP\/\S+ (\d+)/m)?.[1] ?? 0);
  return { ok: status >= 200 && status < 300, status, body: r.stdout?.trim() ? JSON.parse(r.stdout) : null };
};

// What land-lock reads back after this exits: check runs, a note for the landing log, and the head
// each worktree this landing has changed must go back to if it dies before putting it right.
const report = { runs: 0, note: "", restore: {} };
// What the culprit path did (D1763), ahead of report.note in the log's note column.
const notes = [];
const saveReport = () => {
  const file = process.env.JND_LAND_REPORT;
  if (!file) return;
  const note = [...notes, report.note].filter(Boolean).join("; ");
  fs.writeFileSync(`${file}.tmp`, JSON.stringify({ ...report, note }));
  fs.renameSync(`${file}.tmp`, file);
};

// The Land command's hooks, by name: each is a LAND_<NAME>_CMD shell command. A waiter's come
// from its ticket, though batching already requires its LAND_* settings to match the holder's.
const HOOKS = { prepare: "LAND_PREPARE_CMD" };
const hooksOf = (env) => Object.fromEntries(Object.entries(HOOKS).map(([name, key]) => [name, env?.[key] || null]));

// The generated-file pairs an env sets: LAND_REGEN_PATHS/_CMD, then each LAND_REGEN_PATHS_<NAME>
// with its LAND_REGEN_CMD_<NAME>, in name order. A pair missing its paths or its command is dropped.
const regensOf = (env = {}) =>
  Object.keys(env)
    .map((k) => k.match(/^LAND_REGEN_PATHS(_\w+)?$/)?.[1] ?? (k === "LAND_REGEN_PATHS" ? "" : null))
    .filter((s) => s !== null)
    .sort()
    .map((s) => ({ prefixes: (env[`LAND_REGEN_PATHS${s}`] ?? "").split(/\s+/).filter(Boolean), cmd: env[`LAND_REGEN_CMD${s}`] }))
    .filter((r) => r.cmd && r.prefixes.length);

// A landing: this script's own PR, or a waiter's the holder took into its batch.
const holder = {
  pr,
  cwd: here,
  checks,
  regens: regensOf(process.env),
  hooks: hooksOf(process.env),
  lines: [],
};
const say = (m, line) => {
  console.log(line);
  m.lines.push(line);
};

// Worktrees share one ref store, so a fetch from another worktree at the same moment makes ours
// fail with "cannot lock ref" (#430). Retry it a few seconds later before refusing.
const fetchOrigin = (cwd) => {
  let fetched = run(cwd, "git", "fetch", "origin");
  for (const wait of [3, 10]) {
    if (fetched) break;
    console.log(`land: git fetch failed; retrying in ${wait}s`);
    sleep(wait * Number(process.env.JND_LAND_RETRY_SCALE ?? 1));
    fetched = run(cwd, "git", "fetch", "origin");
  }
  if (!fetched) refuse("git fetch failed");
};

// The PR's state and the worktree's; returns the branch, or the merge commit of a merged PR.
const openPr = (m) => {
  const view = api(`pulls/${m.pr}`);
  if (!view.ok) refuse(`tea api pulls/${m.pr} returned ${view.status || "nothing"} (no such PR, or tea isn't logged in)`);
  const p = view.body;
  if (p.merged) return { merged: p.merge_commit_sha };
  if (p.state !== "open") refuse(`PR #${m.pr} is ${p.state}`);
  // Running Land is the decision to land, so a draft is marked ready here rather than refused after
  // a whole queue wait (#467). Forgejo's draft is its title prefix.
  if (p.draft) {
    const title = p.title.replace(/^\s*(\[WIP\]|WIP:)\s*/i, "");
    const ready = api(`pulls/${m.pr}`, "-X", "PATCH", "-d", JSON.stringify({ title }));
    if (!ready.ok || ready.body?.draft) refuse(`PR #${m.pr} is a draft and marking it ready failed (${ready.status}); drop the WIP: from its title`);
    say(m, `land: PR #${m.pr} was a draft; marked it ready ("${title}")`);
  }
  if (p.base.ref !== "main") refuse(`PR #${m.pr} targets ${p.base.ref}, not main`);
  const branch = git(m.cwd, "branch", "--show-current");
  if (branch !== p.head.ref) refuse(`this worktree is on ${branch}, PR #${m.pr} is ${p.head.ref}`);
  if (git(m.cwd, "status", "--porcelain", "--untracked-files=no")) refuse("the worktree has uncommitted changes");
  return { branch };
};

// Merges `ref` into the member's worktree; a conflict only in its generated files is regenerated.
const mergeIn = (m, ref, left = "; the conflict is left in the tree", label = ref) => {
  // A sha merged in a batch gets a message that names it, not git's "Merge commit '<sha>'".
  const message = label === ref ? [] : ["-m", `Merge ${label} (${ref.slice(0, 7)}) into ${m.branch}`];
  if (run(m.cwd, "git", "merge", "--no-edit", ...message, ref)) return;
  const conflicted = git(m.cwd, "diff", "--name-only", "--diff-filter=U").split("\n").filter(Boolean);
  const covers = (r) => (f) => r.prefixes.some((p) => f === p || f.startsWith(p));
  const regens = m.regens ?? [];
  if (conflicted.length === 0 || !conflicted.every((f) => regens.some((r) => covers(r)(f))))
    refuse(`merging ${label} conflicts (${conflicted.join(", ") || "unknown files"})${left}`);
  say(m, `land: only generated files conflict (${conflicted.join(", ")}); taking main's side and regenerating`);
  if (!run(m.cwd, "git", "checkout", "--theirs", "--", ...conflicted)) refuse("taking main's side of the generated files failed");
  for (const { cmd } of regens.filter((r) => conflicted.some(covers(r)))) {
    console.log(`$ ${cmd}`);
    if (spawnSync(cmd, { cwd: m.cwd, stdio: "inherit", shell: true }).status !== 0) refuse(`${cmd} failed; the merge is left in the tree`);
  }
  if (!run(m.cwd, "git", "add", "-A")) refuse("staging the regenerated files failed");
  if (git(m.cwd, "diff", "--name-only", "--diff-filter=U")) refuse("conflicts remain after regenerating");
  if (!run(m.cwd, "git", "commit", "--no-edit")) refuse("committing the merge failed");
};

// Runs the member's `name` hook, if set, with `env` added; refuses when it fails or leaves changes
// uncommitted, with the worktree put back on the head it started from.
const runHook = (m, name, env) => {
  const cmd = m.hooks?.[name];
  if (!cmd) return;
  const start = git(m.cwd, "rev-parse", "HEAD");
  console.log(`$ ${cmd}  (${HOOKS[name]}${Object.entries(env).map(([k, v]) => `, ${k}=${v}`).join("")})`);
  const ok = spawnSync(cmd, { cwd: m.cwd, stdio: "inherit", shell: true, env: { ...process.env, ...env } }).status === 0;
  const dirty = ok && git(m.cwd, "status", "--porcelain", "--untracked-files=no");
  if (ok && !dirty) return;
  resetTo(m, start);
  refuse(`${HOOKS[name]} ${ok ? "left uncommitted changes" : "failed"}; the tree is put back on the merge`);
};
const prepare = (m, base) => runHook(m, "prepare", { LAND_PREPARE_BASE: base });

// The PRs this run merged, in order, for LAND_AFTER_CMD.
const mergedPrs = [];
// The after hook: once, after a run that merged anything; its failure only prints (#1768).
const afterLand = () => {
  const cmd = process.env.LAND_AFTER_CMD;
  if (!cmd || mergedPrs.length === 0) return;
  try {
    let main = "";
    try {
      fetchOrigin(here);
      main = git(here, "rev-parse", "origin/main");
    } catch {}
    const env = { LAND_AFTER_PRS: mergedPrs.join(" "), LAND_AFTER_MAIN: main };
    console.log(`$ ${cmd}  (LAND_AFTER_CMD, LAND_AFTER_PRS=${env.LAND_AFTER_PRS}, LAND_AFTER_MAIN=${main})`);
    // Bounded, since it holds the lock: LAND_AFTER_TIMEOUT_S, default 300.
    const timeout = (Number(process.env.LAND_AFTER_TIMEOUT_S) || 300) * 1000;
    const r = spawnSync(cmd, { cwd: here, stdio: "inherit", shell: true, timeout, env: { ...process.env, ...env } });
    if (r.status !== 0) console.error(`land: LAND_AFTER_CMD failed (${r.error?.code === "ETIMEDOUT" ? "timed out" : `exit ${r.status ?? r.error?.message}`}); the landing stands`);
  } catch (e) {
    console.error(`land: LAND_AFTER_CMD failed (${e?.message ?? e}); the landing stands`);
  }
};

// A PR comment, so the PR's thread sees why it left a batch or failed. Best effort.
const comment = (m, lines) => {
  try {
    const body = `land: PR #${m.pr} did not land in this run.\n\n\`\`\`\n${lines.join("\n")}\n\`\`\``;
    api(`issues/${m.pr}/comments`, "-d", JSON.stringify({ body }));
  } catch {}
};

// Every check run's output also goes to a log of its own, kept two weeks, so a retry never
// overwrites the run before it (lexicontent #1762 lost ~8). `lastLog` names the latest.
const runsDir = path.join(path.resolve(here, process.env.JND_LAND_DIR || git(here, "rev-parse", "--git-common-dir")), "jnd-land-runs");
let lastLog = null;
const newRunLog = () => {
  fs.mkdirSync(runsDir, { recursive: true });
  const old = Date.now() - 14 * 86400000;
  for (const f of fs.readdirSync(runsDir)) {
    try {
      if (fs.statSync(path.join(runsDir, f)).mtimeMs < old) fs.rmSync(path.join(runsDir, f), { force: true });
    } catch {}
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(runsDir, `${stamp}-pr${pr}-run${report.runs}.log`);
};
// Runs one shell command with its output both shown and appended to a file.
const TEE = `const { spawn } = require("node:child_process");
const fs = require("node:fs");
const [file, cmd] = process.argv.slice(1);
const out = fs.openSync(file, "a");
const c = spawn(cmd, { shell: true, stdio: ["inherit", "pipe", "pipe"] });
for (const [from, to] of [[c.stdout, process.stdout], [c.stderr, process.stderr]])
  from.on("data", (d) => { to.write(d); fs.writeSync(out, d); });
c.on("close", (code) => { process.exitCode = code ?? 1; });`;

// One check run; the first check that fails, or null.
const runChecks = (cwd, list) => {
  report.runs += 1;
  saveReport();
  lastLog = newRunLog();
  console.log(`(this run's output is also in ${lastLog})`);
  for (const check of list) {
    console.log(`$ ${check}`);
    fs.appendFileSync(lastLog, `$ ${check}  (in ${cwd})\n`);
    if (spawnSync(process.execPath, ["-e", TEE, lastLog, check], { cwd, stdio: "inherit" }).status !== 0) return check;
  }
  return null;
};

// --- Culprits (D1763) ------------------------------------------------------------------------

const culpritCmd = process.env.LAND_CULPRIT_CMD;
const prList = (ms) => ms.map((m) => `#${m.pr}`).join(", ");
const names = (fails) => {
  const shown = fails.slice(0, 6).map((f) => f.name);
  return shown.join(", ") + (fails.length > shown.length ? ` and ${fails.length - shown.length} more` : "");
};

// Asks the repo's hook whose the failures in the last run are; null when it gives no answer.
const blame = (members, base, failed) => {
  const input = {
    check: failed,
    log: lastLog,
    base,
    members: members.map((m) => ({
      pr: m.pr,
      cwd: m.cwd,
      head: m.orig,
      files: git(m.cwd, "diff", "--name-only", "--no-renames", `${base}...${m.orig}`).split("\n").filter(Boolean),
    })),
  };
  const file = lastLog.replace(/\.log$/, ".blame.json");
  fs.writeFileSync(file, JSON.stringify(input, null, 2));
  console.log(`$ ${culpritCmd} "${file}"`);
  const r = spawnSync(`${culpritCmd} "${file}"`, { cwd: members.at(-1).cwd, shell: true, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
  try {
    const out = JSON.parse(r.stdout);
    if (r.status !== 0 || !Array.isArray(out.failures)) throw new Error(`exit ${r.status}`);
    const prs = new Set(members.map((m) => m.pr));
    const failures = out.failures.map((f) => ({
      name: String(f.name),
      flaky: f.flaky === true,
      suspects: (Array.isArray(f.suspects) ? f.suspects : []).map(String).filter((p) => prs.has(p)),
    }));
    console.log(`land: the culprit hook read ${failures.length ? names(failures) : "no failures"}${out.infra ? ` (infrastructure: ${out.infra})` : ""}`);
    return { infra: out.infra ? String(out.infra) : null, failures };
  } catch (e) {
    console.log(`land: the culprit hook gave no answer (${e.message})`);
    return null;
  }
};

// The members every failure that isn't known-flaky points to, or why there are none.
const verdict = (members, b) => {
  if (!b) return { why: "the culprit hook gave no answer" };
  const real = b.failures.filter((f) => !f.flaky);
  if (real.length === 0) return { why: b.failures.length ? "only known-flaky failures" : "no failure the hook could read" };
  const lost = real.filter((f) => f.suspects.length === 0);
  if (lost.length) return { why: `no member touches ${names(lost)}` };
  const culprits = members.filter((m) => real.some((f) => f.suspects.includes(m.pr)));
  if (culprits.length === members.length) return { why: "every member is a suspect" };
  return { culprits, real };
};

// Checks the tree `members` built on `base` (the last member's worktree, at its HEAD), once more
// when the hook calls the failure infrastructure or known-flaky. Null on a pass; else the failed
// check, its log and the hook's answer, or `moved` when a check moved HEAD.
const checkTree = (members, base, list = checks) => {
  const last = members.at(-1);
  const head = git(last.cwd, "rev-parse", "HEAD");
  for (let attempt = 0; ; attempt += 1) {
    const failed = runChecks(last.cwd, list);
    if (git(last.cwd, "rev-parse", "HEAD") !== head) return { moved: true };
    if (!failed) return null;
    if (!culpritCmd) return { failed, log: lastLog };
    const b = blame(members, base, failed);
    const retry = b?.infra ?? (b?.failures.length && b.failures.every((f) => f.flaky) ? `known-flaky ${names(b.failures)}` : null);
    if (retry && attempt === 0) {
      console.log(`land: ${failed} failed on ${retry}; running the same tree once more`);
      notes.push(`retried ${prList(members)}: ${retry}`);
      continue;
    }
    return { failed, log: lastLog, blame: b };
  }
};
const failText = (r, fails) => `${r.failed} failed${fails?.length ? ` in ${names(fails)}` : ""} (log ${r.log})`;

// Right after a push Forgejo is still testing the PR's mergeability and answers 405 "try again
// later"; refusing then wastes the whole gate run (#316, #317). Retry with backoff, pinned to the
// checked head, so a push to the branch meanwhile still fails the merge.
const mergePinned = (m, head, style) => {
  let merged;
  for (const wait of [0, 5, 10, 20, 30, 60]) {
    if (wait) {
      console.log(`land: the merge returned ${merged.status} (${merged.body?.message ?? ""}); retrying in ${wait}s`);
      sleep(wait * Number(process.env.JND_LAND_RETRY_SCALE ?? 1));
      if (api(`pulls/${m.pr}`).body?.merged) return { ok: true };
    }
    merged = api(`pulls/${m.pr}/merge`, "-d", JSON.stringify({ Do: style, head_commit_id: head }));
    if (merged.ok || merged.status !== 405 || !/try again later/i.test(merged.body?.message ?? "")) break;
  }
  return merged;
};

// Today's landing of one PR, unchanged: a batch of one runs exactly this.
const landSingle = (m) => {
  const open = openPr(m);
  if (open.merged) {
    say(m, `land: PR #${m.pr} already merged at ${open.merged}`);
    return;
  }
  fetchOrigin(m.cwd);
  const base = git(m.cwd, "rev-parse", "origin/main");
  m.orig = git(m.cwd, "rev-parse", "HEAD");
  if (m.hooks?.prepare) {
    // Pinned, so the hook's base is exactly what was merged even if another worktree fetches.
    m.branch = open.branch;
    mergeIn(m, base, undefined, "origin/main");
    prepare(m, base);
  } else mergeIn(m, "origin/main");
  const r = checkTree([m], base, m.checks);
  if (r?.moved) refuse("a check moved HEAD, so the checked tree is unknown");
  if (r) refuse(culpritCmd ? failText(r, r.blame?.failures) : `${r.failed} failed`);
  m.checked = true;
  const head = git(m.cwd, "rev-parse", "HEAD");
  if (!run(m.cwd, "git", "push", "origin", `HEAD:${open.branch}`)) refuse("git push failed");
  const style = api("").body?.default_merge_style ?? "merge";
  m.mergeAsked = true;
  const merged = mergePinned(m, head, style);
  if (!merged.ok) refuse(`the merge returned ${merged.status}: ${merged.body?.message ?? ""}`);
  mergedPrs.push(m.pr);
  say(m, `land: PR #${m.pr} merged (head ${head.slice(0, 7)}, ${style})`);
};

// --- Batches ---------------------------------------------------------------------------------

const waitersDir = process.env.JND_LAND_WAITERS_DIR;
const token = process.env.JND_LAND_TOKEN;
const batchMax = Number(process.env.JND_LAND_BATCH_MAX ?? 3);
const POLL_MS = Number(process.env.JND_LAND_POLL_MS) || 5000;
const WAITER_MAX_AGE_MS = 60 * 1000;
const file = (m, kind) => path.join(waitersDir, `${m.pid}.${kind}.json`);
const readJson = (f) => {
  try {
    return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch {
    return undefined;
  }
};
const writeJson = (f, value) => {
  const temp = `${f}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value));
  // A waiter reading the file can make the rename fail on Windows for a moment.
  for (let i = 0; ; i += 1) {
    try {
      fs.renameSync(temp, f);
      return;
    } catch (e) {
      if (i >= 20) throw e;
      sleep(0.05);
    }
  }
};
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
};
const landEnv = (env) =>
  Object.fromEntries(
    Object.entries(env ?? {}).filter(([k]) => k.startsWith("LAND_") && !k.startsWith("LAND_REGEN_") && k !== "LAND_CULPRIT_CMD"),
  );
const sameEnv = (a, b) => {
  const [x, y] = [landEnv(a), landEnv(b)];
  return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every((k) => x[k] === y[k]);
};
const fresh = (m) => {
  try {
    return Date.now() - fs.statSync(path.join(waitersDir, `${m.pid}.json`)).mtimeMs < WAITER_MAX_AGE_MS;
  } catch {
    return false;
  }
};
// A member still waits for its result: its process runs, its ticket is fresh and its answer stands.
const memberAlive = (m) => m === holder || (alive(m.pid) && fresh(m) && readJson(file(m, "ack"))?.token === token);

// The head a worktree goes back to if this landing dies before it is put right: in the report for
// land-lock, and in a waiter's claim for the waiter itself, should the holder's land-lock die too.
const setRestore = (m, sha) => {
  if (sha) report.restore[m.cwd] = sha;
  else delete report.restore[m.cwd];
  saveReport();
  if (m !== holder) writeJson(file(m, "claim"), { token, pr, restore: sha ?? null });
};
const resetTo = (m, sha) => {
  spawnSync("git", ["merge", "--abort"], { cwd: m.cwd, stdio: "ignore" });
  run(m.cwd, "git", "reset", "--hard", sha);
};

// Waiting landings of this script that may join: oldest first, at most batchMax - 1.
const candidates = () => {
  let names = [];
  try {
    names = fs.readdirSync(waitersDir);
  } catch {}
  const found = [];
  for (const name of names) {
    if (!/^\d+\.json$/.test(name)) continue;
    const t = readJson(path.join(waitersDir, name));
    const pid = Number(name.slice(0, -5));
    if (!t || t.pid !== pid || !alive(pid) || !fresh({ pid })) continue;
    // A result an earlier holder left that the waiter hasn't read yet: leave it to exit on it.
    if (fs.existsSync(path.join(waitersDir, `${pid}.result.json`))) continue;
    if (!/^\d+$/.test(String(t.pr)) || String(t.pr) === pr || !t.cwd || !Array.isArray(t.command)) continue;
    const i = t.command.findIndex((a) => path.basename(a) === "land-forgejo.mjs");
    if (i === -1 || t.command[i + 1] !== String(t.pr) || t.command[i + 2] !== "--") continue;
    const own = t.command.slice(i + 3);
    if (own.length === 0 || !own.every((c) => checks.includes(c)) || !sameEnv(t.env, process.env)) continue;
    found.push({
      pr: String(t.pr),
      pid,
      since: t.since,
      cwd: t.cwd,
      checks: own,
      regens: regensOf(t.env),
      hooks: hooksOf(t.env),
      lines: [],
    });
  }
  found.sort((a, b) => a.since - b.since || a.pid - b.pid);
  return found.slice(0, batchMax - 1);
};

// Claims the candidates and keeps those that answer within two of their polls.
const claimWaiters = () => {
  if (!waitersDir || !token || !(batchMax > 1)) return [];
  let found = candidates();
  if (found.length === 0) return [];
  if ((api("").body?.default_merge_style ?? "merge") !== "merge") return [];
  for (const m of found) {
    for (const kind of ["ack", "result"]) fs.rmSync(file(m, kind), { force: true });
    writeJson(file(m, "claim"), { token, pr, restore: null });
  }
  const deadline = Date.now() + Math.max(2 * POLL_MS + 1000, 2000);
  const acked = (m) => readJson(file(m, "ack"))?.token === token;
  while (Date.now() < deadline && !found.every(acked)) sleep(0.1);
  const joined = found.filter(acked);
  for (const m of found) if (!joined.includes(m)) fs.rmSync(file(m, "claim"), { force: true });
  found = joined;
  if (found.length) console.log(`land: PR #${pr} takes ${found.map((m) => `#${m.pr}`).join(", ")} into its batch`);
  return found;
};

let holderCode = null;
// The outcome a member reports must agree with Forgejo (#1774): a git error after the merge (a
// fetch racing the shared ref store: "cannot lock ref") made a landed PR exit 1, and a landing
// logged "refused" yet exited 0 on a merged PR. So a non-zero code, or a 0 after a refused line,
// asks Forgejo: merged is 0 with a line saying so, confirmed not merged is 1. A clean 0 asks
// nothing. Unanswered after a refusal is 1: a false success is worse than a false failure (a
// thread that believes it landed stops; one that retries a landing that merged finds nothing to do).
const reconcile = (m, code) => {
  const refusedSaid = m.lines.some((l) => l.startsWith("land: refused"));
  if (code === 0 && !refusedSaid) return 0;
  let r;
  try {
    r = api(`pulls/${m.pr}`);
  } catch {
    r = null;
  }
  if (!r?.ok || typeof r.body?.merged !== "boolean") {
    if (!refusedSaid) return code;
    say(m, `land: PR #${m.pr}: refused and merge state unconfirmed (Forgejo unreachable)`);
    return 1;
  }
  if (r.body.merged) {
    say(m, `land: PR #${m.pr} is merged (Forgejo confirms it); the error above does not change that`);
    // Merged by this run's own merge call, so the after hook relays it too (#1768); a PR an earlier
    // run merged isn't relayed again.
    if (m.mergeAsked && !mergedPrs.includes(m.pr)) mergedPrs.push(m.pr);
    return 0;
  }
  if (code === 0) say(m, `land: refused: PR #${m.pr} is not merged (Forgejo confirms it)`);
  return 1;
};
// A member's result: the holder's own is this script's exit code; a waiter's goes to its file. A
// result that can't be written leaves the waiter to void its claim and land again by itself.
const finish = (m, code) => {
  if (m.done) return;
  m.done = true;
  code = reconcile(m, code);
  if (code !== 0) comment(m, m.lines);
  if (m === holder) holderCode = code;
  else {
    try {
      writeJson(file(m, "result"), { code, lines: m.lines, holder: pr });
    } catch (e) {
      console.error(`land: writing PR #${m.pr}'s result failed (${e.message}); its landing will run again by itself`);
    }
  }
};
// Any error while handling one member is that member's refusal, so one PR's worktree or a bad
// answer about it can't fail the others' landings.
const refusedLine = (m, e) => {
  const line = `land: refused: ${e instanceof Refused ? e.message : `unexpected error: ${e?.message ?? e}`}`;
  console.error(line);
  m.lines.push(line);
};

// Lands each member alone, through today's path, in queue order: the holder began waiting first.
const landEach = (members, prefix) => {
  for (const m of members) {
    if (m.done) continue;
    if (!memberAlive(m)) {
      say(m, `land: PR #${m.pr}'s landing was stopped; not landed`);
      finish(m, 1);
      continue;
    }
    let code = 0;
    try {
      setRestore(m, null);
      landSingle(m);
    } catch (e) {
      refusedLine(m, e);
      code = 1;
    }
    if (prefix && !prefix.covered && m.checked) {
      prefix.covered = true;
      say(m, `land: this landing's check of main merged with PR #${m.pr} covered the unchecked prefix ${prefix.sha.slice(0, 7)}`);
    }
    finish(m, code);
  }
};

const landBatch = (waiters) => {
  const members = [...waiters, holder];
  const queue = [holder, ...waiters];
  fetchOrigin(here);
  const main0 = git(here, "rev-parse", "origin/main");
  const batch = [];
  for (const m of members) {
    try {
      const open = openPr(m);
      if (open.merged) {
        say(m, `land: PR #${m.pr} already merged at ${open.merged}`);
        finish(m, 0);
        continue;
      }
      m.branch = open.branch;
      m.orig = git(m.cwd, "rev-parse", "HEAD");
      batch.push(m);
    } catch (e) {
      refusedLine(m, e);
      finish(m, 1);
    }
  }
  // A chain: each member merges the one before, the first merges `base`. For the whole batch that
  // is main as read above (not the origin/main ref, which another worktree's fetch can move
  // meanwhile). A member that can't merge leaves, and lands alone after.
  const build = (members, base) => {
    const chain = [];
    for (const m of members) {
      const label = chain.length ? `the batch so far (${prList(chain)})` : "origin/main";
      try {
        setRestore(m, m.orig);
        mergeIn(m, base, "", label);
        // Against the batch so far, so each member's prepare sees the members merged before it.
        prepare(m, base);
        m.bk = git(m.cwd, "rev-parse", "HEAD");
      } catch (e) {
        // No comment yet: it lands alone after, and finish comments only if that fails too.
        say(m, `land: PR #${m.pr} leaves the batch: ${e instanceof Refused ? e.message : `unexpected error: ${e?.message ?? e}`}`);
        try {
          resetTo(m, m.orig);
          setRestore(m, null);
        } catch {}
        continue;
      }
      base = m.bk;
      chain.push(m);
    }
    return chain;
  };
  const putBack = (members, why) => {
    for (const m of members) {
      if (why) say(m, `land: ${why}; landing PR #${m.pr} alone`);
      resetTo(m, m.orig);
      setRestore(m, null);
    }
  };
  const undo = (why, members) => {
    putBack(members, why);
    landEach(queue);
  };
  // A checked tree lands only with every member's landing still waiting for it.
  const stoppedMembers = (members) => {
    const dead = members.filter((m) => !memberAlive(m));
    if (dead.length === 0) return false;
    for (const m of dead) say(m, `land: PR #${m.pr}'s landing was stopped before the merge; not landed`);
    undo(`${dead.map((m) => `PR #${m.pr}`).join(", ")} stopped waiting, so the checked batch can't land as checked`, members);
    return true;
  };

  const chain = batch.includes(holder) && batch.length > 1 ? build(batch, main0) : [];
  if (chain.length < 2 || chain.at(-1) !== holder) return undo("no batch of two or more could be built", chain);
  console.log(`land: checking the batch ${chain.map((m) => `#${m.pr}`).join(" + ")} at ${holder.bk.slice(0, 7)}`);
  const first = checkTree(chain, main0);
  if (first?.moved) return undo("a check moved HEAD, so the checked tree is unknown", chain);
  if (first && !culpritCmd) return undo(`the batch's check ${first.failed} failed`, chain);
  if (!first) {
    if (stoppedMembers(chain)) return;
    if (mergeChain(chain, main0, queue)) landEach(queue);
    return;
  }

  // The batch failed and the hook is set: drop the culprits and check the rest once, or check
  // the batch in halves, the holder's half first. Only a tree a check passed lands.
  putBack(chain);
  const v = verdict(chain, first.blame);
  let parts;
  if (v.culprits) {
    for (const m of v.culprits) {
      say(m, `land: PR #${m.pr} leaves the batch: its ${failText(first, v.real.filter((f) => f.suspects.includes(m.pr)))}, which points at this PR`);
      finish(m, 1);
    }
    const rest = chain.filter((m) => !v.culprits.includes(m));
    for (const m of rest) say(m, `land: the batch's ${failText(first, v.real)}, which points at ${prList(v.culprits)}; checking ${prList(rest)} again without it`);
    notes.push(`culprit ${prList(v.culprits)}: ${names(v.real)}`);
    parts = [rest];
  } else {
    const k = Math.floor(chain.length / 2);
    parts = [chain.slice(k), chain.slice(0, k)];
    const plan = parts.map((p) => `(${prList(p)})`).join(" then ");
    for (const m of chain) say(m, `land: the batch's ${failText(first)}, not attributed (${v.why}); checking it in halves, ${plan}`);
    notes.push(`unattributed (${v.why}): halves`);
  }
  let base = main0;
  for (let i = 0; i < parts.length; i += 1) {
    const sub = build(parts[i], base);
    if (sub.length === 0) continue;
    console.log(`land: checking ${sub.map((m) => `#${m.pr}`).join(" + ")} at ${sub.at(-1).bk.slice(0, 7)}`);
    const r = checkTree(sub, base);
    if (r?.moved) return undo("a check moved HEAD, so the checked tree is unknown", sub);
    if (r) {
      putBack(sub);
      notes.push(`${prList(sub)} failed again`);
      // A part that names its culprit drops it, with no run of its own, and the rest of the part is
      // checked next as one batch (#1834: #1721 failed three runs, the last one alone).
      const again = sub.length > 1 ? verdict(sub, r.blame) : {};
      if (again.culprits) {
        const rest = sub.filter((m) => !again.culprits.includes(m));
        for (const m of again.culprits) {
          say(m, `land: PR #${m.pr} leaves the batch: its ${failText(r, again.real.filter((f) => f.suspects.includes(m.pr)))}, which points at this PR`);
          finish(m, 1);
        }
        for (const m of rest) say(m, `land: ${prList(sub)}'s ${failText(r, again.real)}, which points at ${prList(again.culprits)}; checking ${prList(rest)} again without it`);
        notes.push(`culprit ${prList(again.culprits)}: ${names(again.real)}`);
        parts.splice(i + 1, 0, rest);
        continue;
      }
      if (sub.length === 1) {
        say(sub[0], `land: refused: ${failText(r, r.blame?.failures)}`);
        finish(sub[0], 1);
      } else {
        for (const m of sub) say(m, `land: ${prList(sub)} failed again: ${failText(r, r.blame?.failures)}; landing PR #${m.pr} alone`);
      }
      continue;
    }
    notes.push(`${prList(sub)} passed`);
    saveReport();
    if (stoppedMembers(sub)) return;
    const end = mergeChain(sub, base, queue);
    if (!end) return;
    base = end;
  }
  // Members that left a chain, or whose part failed again, land alone now.
  landEach(queue);
};

// Pushes and merges a checked chain built on `base`. Each B_k is pushed only once the PR before it
// has merged, so a branch never carries another PR's unmerged commits, and merged pinned to that
// head. From here a member that dies still lands: stopping would leave main on a tree nobody
// checked. Returns main's new head, or null when it stopped partway and has landed the rest alone.
const mergeChain = (chain, base, queue) => {
  let expected = base;
  let stopped = null;
  const landed = [];
  const mergeNext = (m) => {
    fetchOrigin(here);
    const now = git(here, "rev-parse", "origin/main");
    if (now !== expected) return `main moved to ${now.slice(0, 7)} (expected ${expected.slice(0, 7)})`;
    if (!run(m.cwd, "git", "push", "origin", `${m.bk}:refs/heads/${m.branch}`)) return `pushing PR #${m.pr} failed`;
    m.pushed = m.bk;
    setRestore(m, m.bk);
    m.mergeAsked = true;
    const merged = mergePinned(m, m.bk, "merge");
    if (!merged.ok) {
      say(m, `land: the merge of PR #${m.pr} returned ${merged.status}: ${merged.body?.message ?? ""}`);
      return `the merge of PR #${m.pr} failed`;
    }
    landed.push(m);
    mergedPrs.push(m.pr);
    setRestore(m, null);
    fetchOrigin(here);
    expected = git(here, "rev-parse", "origin/main");
    // Should this landing be killed before the next merge, the log still shows the prefix.
    report.note =
      landed.length < chain.length
        ? `unchecked-prefix ${expected.slice(0, 7)} holds ${landed.map((l) => `#${l.pr}`).join(", ")} if the batch stops here`
        : "";
    saveReport();
    say(m, `land: PR #${m.pr} merged in PR #${pr}'s batch (head ${m.bk.slice(0, 7)}, merge ${expected.slice(0, 7)})`);
    if (git(here, "rev-parse", `${expected}^{tree}`) !== git(here, "rev-parse", `${m.bk}^{tree}`))
      return `main's tree after PR #${m.pr}'s merge isn't the tree checked for it`;
    return null;
  };
  for (const m of chain) {
    try {
      stopped = mergeNext(m);
    } catch (e) {
      stopped = e instanceof Refused ? e.message : `unexpected error: ${e?.message ?? e}`;
    }
    if (stopped) break;
  }
  if (!stopped) {
    report.note = "";
    saveReport();
    for (const m of chain) finish(m, 0);
    return expected;
  }
  const rest = chain.filter((m) => !landed.includes(m));
  let prefix = null;
  if (landed.length > 0) {
    prefix = { sha: expected, covered: false };
    const note = `unchecked-prefix ${expected.slice(0, 7)} holds ${landed.map((m) => `#${m.pr}`).join(", ")}: ${stopped}`;
    report.note = note;
    saveReport();
    for (const m of chain) say(m, `land: ${note}`);
  } else {
    for (const m of rest) say(m, `land: ${stopped}`);
  }
  for (const m of landed) finish(m, 0);
  for (const m of rest) {
    say(m, `land: landing PR #${m.pr} alone`);
    resetTo(m, m.pushed ?? m.orig);
    setRestore(m, null);
  }
  landEach(queue, prefix);
  if (prefix && !prefix.covered) checkPrefix(prefix);
  return null;
};

// No landing after a stopped batch checked main, so check origin/main itself in this worktree.
const checkPrefix = (prefix) => {
  say(holder, `land: no landing after the batch checked main; checking origin/main at ${prefix.sha.slice(0, 7)} here`);
  if (git(here, "status", "--porcelain", "--untracked-files=no")) {
    say(holder, "land: unchecked prefix left unchecked: this worktree isn't clean");
    report.note += "; left unchecked";
    saveReport();
    return;
  }
  const branch = git(here, "branch", "--show-current");
  fetchOrigin(here);
  if (!run(here, "git", "checkout", "--detach", "origin/main")) return;
  const failed = runChecks(here, checks);
  const verdict = failed ? `${failed} FAILED on it` : "its check passed";
  say(holder, `land: the unchecked prefix ${prefix.sha.slice(0, 7)}: ${verdict}`);
  report.note += `; ${verdict}`;
  saveReport();
  run(here, "git", "checkout", branch);
};

saveReport();
try {
  const waiters = claimWaiters();
  if (waiters.length === 0) {
    landSingle(holder);
    holderCode = 0;
  } else {
    try {
      landBatch(waiters);
    } finally {
      // An unexpected error mid-batch: put every worktree this landing changed back.
      for (const [cwd, sha] of Object.entries(report.restore)) resetTo({ cwd }, sha);
      report.restore = {};
    }
  }
} catch (e) {
  // Any error, a Refused or a git command that threw, is the holder's refusal, unless Forgejo says
  // it merged (reconcile below).
  if (holder.done) console.error(`land: after PR #${pr}'s result: ${e?.message ?? e}`);
  else {
    refusedLine(holder, e);
    holderCode = 1;
  }
}
if (!holder.done) {
  holderCode = reconcile(holder, holderCode ?? 1);
  if (holderCode !== 0) comment(holder, holder.lines);
}
afterLand();
saveReport();
process.exit(holderCode ?? 1);
