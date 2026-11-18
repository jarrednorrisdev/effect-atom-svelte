// node --test land-batch.test.mjs
// Batched landings (D294) end to end: land-lock.mjs and land-forgejo.mjs for real, on a temp git
// repo with a bare origin and one worktree per PR, against a fake `tea` that keeps the PRs in a
// JSON file and merges into the bare origin the way Forgejo's "merge" style does. Nothing touches
// a real lock, a real repo or Forgejo.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const lockScript = path.join(here, "land-lock.mjs");
const landScript = path.join(here, "land-forgejo.mjs");
const node = process.execPath;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const FAKE_TEA = `import { execFileSync } from "node:child_process";
import fs from "node:fs";
const stateFile = process.env.FAKE_TEA_STATE;
const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
const args = process.argv.slice(2);
let method = "GET";
let body;
for (let i = 2; i < args.length - 1; i += 1) {
  if (args[i] === "-X") method = args[++i];
  else if (args[i] === "-d") {
    body = JSON.parse(args[++i]);
    if (method === "GET") method = "POST";
  }
}
const route = args.at(-1).replace("repos/{owner}/{repo}", "");
fs.appendFileSync(state.calls, JSON.stringify({ method, route, body }) + "\\n");
const save = () => fs.writeFileSync(stateFile, JSON.stringify(state));
const reply = (status, obj) => {
  process.stderr.write("HTTP/1.1 " + status + " X\\n");
  if (obj !== undefined) process.stdout.write(JSON.stringify(obj));
  process.exit(0);
};
const g = (...a) => execFileSync("git", ["--git-dir", state.origin, ...a], { encoding: "utf8" }).trim();
if (route === "") reply(200, { default_merge_style: state.style });
const m = route.match(/^\\/pulls\\/(\\d+)(\\/merge)?$/);
const p = m && state.prs[m[1]];
if (!p) reply(404, { message: "no such PR" });
const view = () => ({ number: Number(m[1]), state: p.state, merged: p.merged, merge_commit_sha: p.merge ?? null,
  draft: /^WIP:/.test(p.title), title: p.title, base: { ref: "main" }, head: { ref: p.branch } });
if (!m[2] && method === "PATCH") { p.title = body.title; save(); reply(201, view()); }
// down[n]: once PR n has merged, reading it fails (Forgejo unreachable).
if (!m[2] && (state.down ?? {})[m[1]] && p.merged) reply(503, { message: "unavailable" });
if (!m[2]) reply(200, view());
const failure = (state.fail[m[1]] ?? []).shift();
if (failure) { save(); reply(failure.status, { message: failure.message }); }
// noop[n]: answer 200 but merge nothing (a reported merge that didn't happen).
if ((state.noop ?? {})[m[1]]) reply(200);
const head = g("rev-parse", "refs/heads/" + p.branch);
if (body.head_commit_id !== head) reply(409, { message: "head out of date" });
const main = g("rev-parse", "refs/heads/main");
const tree = g("merge-tree", "--write-tree", main, head);
const merge = g("commit-tree", tree, "-p", main, "-p", head, "-m", "Merge PR " + m[1]);
g("update-ref", "refs/heads/main", merge, main);
p.merged = true;
p.state = "closed";
p.merge = merge;
save();
// after[n]: the merge happened, then the reply is an error (an error after the merge).
const after = (state.after ?? {})[m[1]];
if (after) reply(after.status, { message: after.message });
reply(200);
`;

// The landing check: records the tree it saw, fails on a bad.txt, and waits for a gate file when
// one is set, so a test can act while the check runs.
const CHECK = `import { execFileSync } from "node:child_process";
import fs from "node:fs";
const [out, gate] = process.argv.slice(2);
const g = (...a) => execFileSync("git", a, { encoding: "utf8" }).trim();
const seen = { cwd: process.cwd(), head: g("rev-parse", "HEAD"), tree: g("rev-parse", "HEAD^{tree}"),
  files: g("ls-files").split("\\n").sort(), branch: g("branch", "--show-current") };
fs.appendFileSync(out, JSON.stringify(seen) + "\\n");
if (gate) {
  fs.writeFileSync(gate + ".started", "");
  while (!fs.existsSync(gate)) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
}
const failAfter = Number(process.env.CHECK_FAIL_AFTER);
const count = fs.readFileSync(out, "utf8").trim().split("\\n").length;
// A fail-<name>.txt fails test <name>. The combo-a + combo-b interaction shows only when nothing
// else failed, like a later step. CHECK_INFRA_ONCE fails the first run on "infrastructure".
const fails = seen.files.filter((f) => /^fail-.*\\.txt$/.test(f)).map((f) => f.slice(5, -4));
for (const f of fails) console.log("FAIL test " + f);
const combo = fails.length === 0 && seen.files.includes("combo-a.txt") && seen.files.includes("combo-b.txt");
if (combo) console.log("FAIL test combo");
// any-a + any-b fails test "any", which the hook pins on every member.
const any = seen.files.includes("any-a.txt") && seen.files.includes("any-b.txt");
if (any) console.log("FAIL test any");
const infraOnce = process.env.CHECK_INFRA_ONCE;
const infra = Boolean(infraOnce) && !fs.existsSync(infraOnce);
if (infra) { fs.writeFileSync(infraOnce, ""); console.log("INFRA-BOOM"); }
process.exit(fs.existsSync("bad.txt") || (failAfter && count > failAfter) || fails.length || combo || any || infra ? 1 : 0);
`;

// The repo's culprit hook (D1763): test <name> belongs to the member that adds fail-<name>.txt.
const HOOK = `import fs from "node:fs";
const input = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const log = fs.readFileSync(input.log, "utf8");
if (log.includes("INFRA-BOOM")) { console.log(JSON.stringify({ infra: "boom", failures: [] })); process.exit(0); }
const failures = [...log.matchAll(/^FAIL test (\\S+)\\r?$/gm)].map(([, name]) => ({
  name,
  suspects: input.members.filter((m) => name === "any" || m.files.includes("fail-" + name + ".txt")).map((m) => m.pr),
}));
console.log(JSON.stringify({ failures }));
`;

// Rewrites gen.txt from the pr-*.txt files present: the generated file two PRs both touch.
const REGEN = `import fs from "node:fs";
fs.writeFileSync("gen.txt", fs.readdirSync(".").filter((f) => /^pr-\\d+\\.txt$/.test(f)).sort().join("\\n") + "\\n");
`;

// A prepare hook like a repo's migration renumbering: m-<n>.txt files the tree adds over
// LAND_PREPARE_BASE move past the base's highest number, keeping their order, then it commits.
// It logs each run; hookfail.txt makes it fail, and hookdirty.txt makes it leave a change.
const PREPARE = `import { execFileSync } from "node:child_process";
import fs from "node:fs";
const g = (...a) => execFileSync("git", a, { encoding: "utf8" }).trim();
const base = process.env.LAND_PREPARE_BASE;
fs.appendFileSync(process.argv[2], JSON.stringify({ cwd: process.cwd(), base, head: g("rev-parse", "HEAD") }) + "\\n");
if (fs.existsSync("hookfail.txt")) process.exit(3);
if (fs.existsSync("hookdirty.txt")) { fs.writeFileSync("a.txt", "dirty\\n"); process.exit(0); }
const num = (f) => Number(f.match(/^m-(\\d+)-\\w+\\.txt$/)?.[1] ?? 0);
const inBase = g("ls-tree", "--name-only", base).split("\\n").filter(num);
let next = Math.max(0, ...inBase.map(num)) + 1;
const moves = [];
for (const f of g("ls-files").split("\\n").filter((f) => num(f) && !inBase.includes(f)).sort((a, b) => num(a) - num(b))) {
  const n = Math.max(num(f), next);
  next = n + 1;
  if (n !== num(f)) moves.push([f, f.replace(/^m-\\d+/, "m-" + n)]);
}
for (const [from, to] of moves.reverse()) g("mv", from, to);
if (moves.length) g("commit", "-q", "-m", "renumber");
`;

const setup = (prs, { style = "merge", fail = {}, after = {}, noop = {}, down = {}, gate = false, main = {}, hook = false, batchMax } = {}) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "land-batch-"));
  const origin = path.join(dir, "origin.git");
  const repo = path.join(dir, "repo");
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: "t",
    GIT_AUTHOR_EMAIL: "t@t",
    GIT_COMMITTER_NAME: "t",
    GIT_COMMITTER_EMAIL: "t@t",
    GIT_TERMINAL_PROMPT: "0",
  };
  for (const k of Object.keys(env)) if (k.startsWith("LAND_") || k.startsWith("JND_LAND_")) delete env[k];
  const git = (cwd, ...a) => execFileSync("git", a, { cwd, env, encoding: "utf8" }).trim();
  git(dir, "init", "-q", "--bare", "-b", "main", origin);
  git(dir, "clone", "-q", origin, repo);
  git(repo, "config", "commit.gpgsign", "false");
  git(repo, "symbolic-ref", "HEAD", "refs/heads/main");
  fs.writeFileSync(path.join(repo, "a.txt"), "a\n");
  fs.writeFileSync(path.join(repo, ".gitignore"), "*.tmp\n");
  git(repo, "add", ".");
  git(repo, "commit", "-q", "-m", "init");
  git(repo, "push", "-q", "origin", "main");
  const fixtures = path.join(dir, "fixtures");
  fs.mkdirSync(fixtures);
  const tea = path.join(fixtures, "tea.mjs");
  const check = path.join(fixtures, "check.mjs");
  const regen = path.join(fixtures, "regen.mjs");
  fs.writeFileSync(tea, FAKE_TEA);
  fs.writeFileSync(check, CHECK);
  fs.writeFileSync(regen, REGEN);
  const prepareScript = path.join(fixtures, "prepare.mjs");
  fs.writeFileSync(prepareScript, PREPARE);
  const preparesOut = path.join(dir, "prepares.jsonl");
  const prepareEnv = { LAND_PREPARE_CMD: `"${node}" "${prepareScript}" "${preparesOut}"` };
  const hookFile = path.join(fixtures, "hook.mjs");
  fs.writeFileSync(hookFile, HOOK);
  if (hook) env.LAND_CULPRIT_CMD = `"${node}" "${hookFile}"`;
  if (batchMax) env.JND_LAND_BATCH_MAX = String(batchMax);
  const checksOut = path.join(dir, "checks.jsonl");
  const gateFile = path.join(dir, "gate");
  const checkCmd = `"${node}" "${check}" "${checksOut}"${gate ? ` "${gateFile}"` : ""}`;
  const state = { origin, calls: path.join(dir, "calls.jsonl"), style, fail, after, noop, down, prs: {} };
  const wt = {};
  for (const [n, files] of Object.entries(prs)) {
    const branch = `pr-${n}`;
    wt[n] = path.join(dir, `wt-${n}`);
    git(repo, "worktree", "add", "-q", "-b", branch, wt[n], "origin/main");
    for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(wt[n], name), text);
    git(wt[n], "add", ".");
    git(wt[n], "commit", "-q", "-m", `PR ${n}`);
    git(wt[n], "push", "-q", "origin", branch);
    state.prs[n] = { branch, state: "open", merged: false, title: `PR ${n}` };
  }
  // Main moves on after the branches were cut.
  if (Object.keys(main).length) {
    for (const [name, text] of Object.entries(main)) fs.writeFileSync(path.join(repo, name), text);
    git(repo, "add", ".");
    git(repo, "commit", "-q", "-m", "main moves");
    git(repo, "push", "-q", "origin", "main");
  }
  const stateFile = path.join(dir, "tea-state.json");
  fs.writeFileSync(stateFile, JSON.stringify(state));
  const lockDir = path.join(dir, "lockdir");
  fs.mkdirSync(lockDir);
  Object.assign(env, {
    JND_LAND_DIR: lockDir,
    JND_LAND_POLL_MS: "100",
    JND_LAND_RETRY_SCALE: "0",
    JND_LAND_TEA: JSON.stringify([node, tea]),
    FAKE_TEA_STATE: stateFile,
  });
  const land = (n, extraEnv = {}) => {
    const child = spawn(node, [lockScript, "--pr", n, "--max-wait", "120", "--", node, landScript, n, "--", checkCmd], {
      cwd: wt[n],
      env: { ...env, ...extraEnv },
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    const done = new Promise((resolve) => child.on("close", (status) => resolve({ status, out })));
    return { child, done };
  };
  const lines = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8").trim().split("\n").filter(Boolean) : []);
  const tea_ = () => JSON.parse(fs.readFileSync(stateFile, "utf8"));
  const calls = () => lines(state.calls).map((l) => JSON.parse(l));
  const merges = () => calls().filter((c) => c.route.endsWith("/merge"));
  const checksRun = () => lines(checksOut).map((l) => JSON.parse(l));
  const mainFiles = () => git(repo, "--git-dir", origin, "ls-tree", "--name-only", "main").split("\n").sort();
  const mainTree = () => git(repo, "--git-dir", origin, "rev-parse", "main^{tree}");
  const logRows = () => lines(path.join(lockDir, "jnd-land-log.tsv")).slice(1).map((l) => l.split("\t"));
  const ticket = (n) => {
    const w = path.join(lockDir, "jnd-land-waiters");
    return fs.existsSync(w) && fs.readdirSync(w).some((f) => /^\d+\.json$/.test(f) && fs.readFileSync(path.join(w, f), "utf8").includes(`"pr":"${n}"`));
  };
  const holdLock = () => {
    const lock = path.join(lockDir, "jnd-land.lock");
    fs.mkdirSync(lock);
    fs.writeFileSync(path.join(lock, "owner.json"), JSON.stringify({ pid: process.pid, pr: "0", token: "test", started: Date.now(), beat: Date.now() }));
    return () => fs.rmSync(lock, { recursive: true, force: true });
  };
  // Starts each PR's landing in turn behind a held lock, each once the one before has queued, then frees it.
  const queueAll = async (ns, extraEnv = {}) => {
    const free = holdLock();
    const runs = {};
    for (const n of ns) {
      runs[n] = land(n, extraEnv[n]);
      while (!ticket(n)) await pause(30);
      await pause(30);
    }
    free();
    return runs;
  };
  const preparesRun = () => lines(preparesOut).map((l) => JSON.parse(l));
  const mainText = (name) => git(repo, "--git-dir", origin, "show", `main:${name}`);
  const comments = (n) => calls().filter((c) => c.route === `/issues/${n}/comments`).map((c) => c.body.body);
  const runLogs = () => {
    const d = path.join(lockDir, "jnd-land-runs");
    return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith(".log")) : [];
  };
  return { dir, git, wt, origin, gateFile, land, queueAll, calls, merges, checksRun, mainFiles, mainTree, logRows, comments, runLogs, tea: tea_, prepareEnv, preparesRun, mainText };
};

const results = async (runs) => Object.fromEntries(await Promise.all(Object.entries(runs).map(async ([n, r]) => [n, await r.done])));
const prFiles = (n) => ({ [`pr-${n}.txt`]: `${n}\n` });

test("a batch that passes lands every PR on one check run, each merge pinned to the checked chain", async () => {
  const t = setup({ 1: prFiles(1), 2: prFiles(2), 3: prFiles(3) });
  const r = await results(await t.queueAll(["1", "2", "3"]));
  for (const n of ["1", "2", "3"]) assert.equal(r[n].status, 0, r[n].out);
  const checked = t.checksRun();
  assert.equal(checked.length, 1, "one check run for three PRs");
  assert.equal(checked[0].cwd, t.wt["1"], "the batch is checked in the holder's worktree");
  assert.deepEqual(checked[0].files, [".gitignore", "a.txt", "pr-1.txt", "pr-2.txt", "pr-3.txt"]);
  // Waiters in queue order, then the holder; each pinned to a head of the chain.
  const merges = t.merges();
  assert.deepEqual(merges.map((m) => m.route), ["/pulls/2/merge", "/pulls/3/merge", "/pulls/1/merge"]);
  assert.equal(merges.at(-1).body.head_commit_id, checked[0].head, "the last merge is the checked head");
  for (const m of merges) assert.equal(m.body.Do, "merge");
  // Each pinned head is an ancestor of the next, so the chain is one line ending on the checked head.
  const heads = merges.map((m) => m.body.head_commit_id);
  for (let i = 1; i < heads.length; i += 1) t.git(t.wt["1"], "merge-base", "--is-ancestor", heads[i - 1], heads[i]);
  assert.equal(t.mainTree(), checked[0].tree, "main ends on exactly the checked tree");
  assert.match(r["2"].out, /rode in PR 1's batch/);
  assert.match(r["2"].out, /land: PR #2 merged in PR #1's batch/);
  const rows = t.logRows();
  const byPr = Object.fromEntries(rows.map((row) => [row[1], row]));
  assert.equal(byPr["1"][6], "1");
  assert.equal(byPr["2"][6], "0");
  assert.equal(byPr["3"][6], "0");
  assert.match(byPr["2"][7], /^batched in PR 1$/);
});

test("a batch whose check fails lands each PR alone, so the bad one fails only itself", async () => {
  const t = setup({ 1: prFiles(1), 2: { ...prFiles(2), "bad.txt": "x\n" }, 3: prFiles(3) });
  const r = await results(await t.queueAll(["1", "2", "3"]));
  assert.equal(r["1"].status, 0, r["1"].out);
  assert.equal(r["2"].status, 1, r["2"].out);
  assert.equal(r["3"].status, 0, r["3"].out);
  assert.match(r["2"].out, /land: refused: .*check\.mjs.* failed/);
  const checked = t.checksRun();
  assert.equal(checked.length, 4, "the batch, then one run each");
  assert.deepEqual(t.mainFiles(), [".gitignore", "a.txt", "pr-1.txt", "pr-3.txt"]);
  assert.deepEqual(t.merges().map((m) => m.route), ["/pulls/1/merge", "/pulls/3/merge"]);
  assert.equal(t.mainTree(), checked.at(-1).tree, "main ends on the last tree checked");
  // No branch carries another PR's commits: PR 2's branch still holds only its own.
  const pr2 = t.git(t.wt["2"], "ls-tree", "--name-only", "origin/pr-2").split("\n").sort();
  assert.equal(pr2.includes("pr-1.txt") || pr2.includes("pr-3.txt"), false, pr2.join(", "));
  assert.equal(t.logRows().find((row) => row[1] === "1")[6], "4");
});

test("a batch of one lands as today: one check, one merge pinned to its head, no batch traffic", async () => {
  const t = setup({ 1: prFiles(1) });
  const r = await t.land("1").done;
  assert.equal(r.status, 0, r.out);
  const checked = t.checksRun();
  assert.equal(checked.length, 1);
  const merges = t.merges();
  assert.equal(merges.length, 1);
  assert.equal(merges[0].body.head_commit_id, checked[0].head);
  assert.match(r.out, /land: PR #1 merged \(head [0-9a-f]{7}, merge\)/);
  assert.doesNotMatch(r.out, /into its batch|'s batch|rode in/);
  // Today's Forgejo traffic, call for call: the PR, the merge style after the push, the merge.
  assert.deepEqual(t.calls().map((c) => `${c.method} ${c.route}`), ["GET /pulls/1", "GET ", "POST /pulls/1/merge"]);
  assert.deepEqual(
    r.out.split("\n").filter((l) => /^(\$ git|land:)/.test(l)),
    ["$ git fetch origin", "$ git merge --no-edit origin/main", "$ git push origin HEAD:pr-1", `land: PR #1 merged (head ${checked[0].head.slice(0, 7)}, merge)`],
  );
  assert.equal(t.mainTree(), checked[0].tree);
  assert.equal(t.logRows()[0][6], "1");
});

// #1774: the outcome agrees with Forgejo. PR 1671 merged, then a "cannot lock ref" error made its
// landing exit 1; PR #1685's landing said "refused" yet exited 0.
test("an error after a confirmed merge is a warning: exit 0, logged as merged, no refusal comment", async () => {
  const t = setup({ 1: prFiles(1) }, { after: { 1: { status: 500, message: "error: cannot lock ref 'refs/remotes/origin/main'" } } });
  const r = await t.land("1").done;
  assert.equal(r.status, 0, r.out);
  assert.equal(t.tea().prs["1"].merged, true);
  assert.match(r.out, /land: refused: the merge returned 500: error: cannot lock ref/);
  assert.match(r.out, /land: PR #1 is merged \(Forgejo confirms it\); the error above does not change that/);
  assert.deepEqual(t.comments("1"), [], "a landed PR gets no refusal comment");
  assert.equal(t.logRows()[0][4], "0", "the landing log records exit 0");
});

test("a refusal whose merge state Forgejo can't confirm exits 1, never a false success", async () => {
  const t = setup({ 1: prFiles(1) }, { after: { 1: { status: 500, message: "boom" } }, down: { 1: true } });
  const r = await t.land("1").done;
  assert.equal(t.tea().prs["1"].merged, true);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /land: PR #1: refused and merge state unconfirmed \(Forgejo unreachable\)/);
  assert.doesNotMatch(r.out, /Forgejo confirms it/);
});

test("a clean merge reply is trusted: no second question on the happy path", async () => {
  const t = setup({ 1: prFiles(1) }, { noop: { 1: true } });
  const r = await t.land("1").done;
  assert.equal(t.tea().prs["1"].merged, false);
  assert.equal(r.status, 0, "a clean 200 is trusted without a second question");
  assert.deepEqual(t.calls().map((c) => `${c.method} ${c.route}`), ["GET /pulls/1", "GET ", "POST /pulls/1/merge"]);
});

test("a refusal on a PR Forgejo says is not merged stays exit 1", async () => {
  const t = setup({ 1: { ...prFiles(1), "bad.txt": "x\n" } });
  const r = await t.land("1").done;
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /land: refused: /);
  assert.doesNotMatch(r.out, /Forgejo confirms it/);
  assert.equal(t.comments("1").length, 1);
});

test("a waiter killed while the batch is checked drops the batch; the others land alone", async () => {
  const t = setup({ 1: prFiles(1), 2: prFiles(2), 3: prFiles(3) }, { gate: true });
  const runs = await t.queueAll(["1", "2", "3"]);
  while (!fs.existsSync(`${t.gateFile}.started`)) await pause(50);
  runs["2"].child.kill();
  await runs["2"].done;
  fs.writeFileSync(t.gateFile, "");
  const r1 = await runs["1"].done;
  const r3 = await runs["3"].done;
  assert.equal(r1.status, 0, r1.out);
  assert.equal(r3.status, 0, r3.out);
  assert.match(r1.out, /PR #2's landing was stopped before the merge; not landed/);
  assert.deepEqual(t.mainFiles(), [".gitignore", "a.txt", "pr-1.txt", "pr-3.txt"]);
  assert.equal(t.tea().prs["2"].merged, false);
  assert.equal(t.checksRun().length, 3, "the dropped batch, then PR 1 and PR 3 alone");
  // The killed waiter's worktree is back on its own head, without the batch's merges.
  assert.equal(t.git(t.wt["2"], "rev-parse", "HEAD"), t.git(t.wt["2"], "rev-parse", "origin/pr-2"));
});

test("a second merge that fails leaves main on an unchecked prefix, which is logged and covered", async () => {
  const fail = { 3: [{ status: 500, message: "boom" }] };
  const t = setup({ 1: prFiles(1), 2: prFiles(2), 3: prFiles(3) }, { fail });
  const r = await results(await t.queueAll(["1", "2", "3"]));
  for (const n of ["1", "2", "3"]) assert.equal(r[n].status, 0, r[n].out);
  for (const n of ["1", "2", "3"]) assert.match(r[n].out, /land: unchecked-prefix [0-9a-f]{7} holds #2: the merge of PR #3 failed/);
  // The fallback runs in queue order, so the holder's own landing alone checks main first.
  assert.match(r["1"].out, /landing's check of main merged with PR #1 covered the unchecked prefix/);
  const holderRow = t.logRows().find((row) => row[1] === "1");
  assert.match(holderRow[7], /^unchecked-prefix [0-9a-f]{7} holds #2/);
  assert.deepEqual(t.mainFiles(), [".gitignore", "a.txt", "pr-1.txt", "pr-2.txt", "pr-3.txt"]);
  assert.equal(t.mainTree(), t.checksRun().at(-1).tree);
});

test("an unchecked prefix no later landing checks is checked on origin/main", async () => {
  // The holder's merge fails every time, and its check fails after the batch's run.
  const fail = { 1: Array(20).fill({ status: 500, message: "boom" }) };
  const t = setup({ 1: prFiles(1), 2: prFiles(2) }, { fail });
  const r = await results(await t.queueAll(["1", "2"], { 1: { CHECK_FAIL_AFTER: "1" }, 2: { CHECK_FAIL_AFTER: "1" } }));
  assert.equal(r["2"].status, 0, r["2"].out);
  assert.equal(r["1"].status, 1, r["1"].out);
  const checked = t.checksRun();
  assert.equal(checked.length, 3, "the batch, PR 1 alone, then origin/main");
  assert.equal(checked[2].branch, "", "the prefix is checked detached");
  assert.equal(checked[2].tree, t.mainTree());
  assert.match(r["1"].out, /checking origin\/main at [0-9a-f]{7} here/);
  assert.match(t.logRows().find((row) => row[1] === "1")[7], /unchecked-prefix .* FAILED on it/);
  assert.equal(t.git(t.wt["1"], "branch", "--show-current"), "pr-1", "the holder's worktree is back on its branch");
});

test("a 405 'try again later' on a member's merge is retried, not the end of the batch", async () => {
  const fail = { 2: [{ status: 405, message: "Please try again later" }] };
  const t = setup({ 1: prFiles(1), 2: prFiles(2) }, { fail });
  const r = await results(await t.queueAll(["1", "2"]));
  assert.equal(r["1"].status, 0, r["1"].out);
  assert.equal(r["2"].status, 0, r["2"].out);
  assert.equal(t.checksRun().length, 1);
  assert.doesNotMatch(r["1"].out, /unchecked-prefix/);
});

test("each member regenerates its own generated-file conflict inside the chain", async () => {
  const gen = (n) => ({ ...prFiles(n), "gen.txt": `pr-${n}.txt\n` });
  const t = setup({ 1: prFiles(1), 2: gen(2), 3: gen(3) });
  const regen = { LAND_REGEN_PATHS: "gen.txt", LAND_REGEN_CMD: `"${node}" "${path.join(t.dir, "fixtures", "regen.mjs")}"` };
  const r = await results(await t.queueAll(["1", "2", "3"], { 3: regen }));
  for (const n of ["1", "2", "3"]) assert.equal(r[n].status, 0, r[n].out);
  assert.equal(t.checksRun().length, 1);
  assert.match(r["3"].out, /only generated files conflict \(gen\.txt\)/);
  const genText = t.git(t.wt["1"], "--git-dir", t.origin, "show", "main:gen.txt");
  assert.equal(genText, "pr-2.txt\npr-3.txt");
});

test("a member that conflicts with the chain leaves the batch, and the holder lands it alone after", async () => {
  const t = setup({ 1: prFiles(1), 2: { ...prFiles(2), "x.txt": "two\n" }, 3: { ...prFiles(3), "x.txt": "three\n" } });
  const r = await results(await t.queueAll(["1", "2", "3"]));
  assert.equal(r["1"].status, 0, r["1"].out);
  assert.equal(r["2"].status, 0, r["2"].out);
  // PR 3 conflicts with PR 2 in the chain, then with main alone: refused, the conflict left to fix.
  assert.equal(r["3"].status, 1, r["3"].out);
  assert.match(r["3"].out, /land: PR #3 leaves the batch: merging the batch so far \(#2\) conflicts \(x\.txt\)/);
  assert.match(r["3"].out, /land: refused: merging origin\/main conflicts \(x\.txt\); the conflict is left in the tree/);
  assert.doesNotMatch(r["3"].out, /back in the queue/);
  assert.equal(t.checksRun().length, 1, "the batch of 2 + 1; PR 3 refuses before its checks");
  assert.deepEqual(t.mainFiles(), [".gitignore", "a.txt", "pr-1.txt", "pr-2.txt", "x.txt"]);
  assert.equal(t.comments("3").length, 1, "one comment, from its lone landing's refusal");
  assert.deepEqual(t.comments("2"), []);
});

test("a member that leaves the chain on a conflict and then lands alone gets no comment", async () => {
  // #3 conflicts with #2 only; #2 fails the check, so the batch lands each alone and #3 lands.
  const t = setup({ 1: prFiles(1), 2: { ...prFiles(2), "x.txt": "two\n", "bad.txt": "x\n" }, 3: { ...prFiles(3), "x.txt": "three\n" } });
  const r = await results(await t.queueAll(["1", "2", "3"]));
  assert.equal(r["3"].status, 0, r["3"].out);
  assert.match(r["3"].out, /land: PR #3 leaves the batch/);
  assert.equal(r["2"].status, 1, r["2"].out);
  assert.deepEqual(t.comments("3"), []);
  assert.equal(t.comments("2").length, 1);
});

test("a claimed waiter whose holder's beat went stale voids the claim, though the pid runs", async () => {
  const t = setup({ 6: prFiles(6) });
  const lockDir = path.join(t.dir, "lockdir");
  const lock = path.join(lockDir, "jnd-land.lock");
  fs.mkdirSync(lock);
  const owner = (beat) => JSON.stringify({ pid: process.pid, pr: "9", token: "reused", started: Date.now(), beat });
  fs.writeFileSync(path.join(lock, "owner.json"), owner(Date.now()));
  const run = t.land("6");
  const waiters = path.join(lockDir, "jnd-land-waiters");
  const pid = run.child.pid;
  while (!fs.existsSync(path.join(waiters, `${pid}.json`))) await pause(30);
  fs.writeFileSync(path.join(waiters, `${pid}.claim.json`), JSON.stringify({ token: "reused", pr: "9", restore: null }));
  while (!fs.existsSync(path.join(waiters, `${pid}.ack.json`))) await pause(30);
  // The holder died and its pid now belongs to a live process (this one): only the beat tells.
  fs.writeFileSync(path.join(lock, "owner.json"), owner(Date.now() - 6 * 60 * 1000));
  const r = await run.done;
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /back in the queue/);
  assert.equal(t.tea().prs["6"].merged, true);
});

test("a waiter whose claim's holder is gone voids it and lands by itself", async () => {
  const t = setup({ 5: prFiles(5) });
  const lockDir = path.join(t.dir, "lockdir");
  const lock = path.join(lockDir, "jnd-land.lock");
  fs.mkdirSync(lock);
  fs.writeFileSync(path.join(lock, "owner.json"), JSON.stringify({ pid: process.pid, pr: "9", token: "dead-holder", started: Date.now(), beat: Date.now() }));
  const run = t.land("5");
  const waiters = path.join(lockDir, "jnd-land-waiters");
  const pid = run.child.pid;
  while (!fs.existsSync(path.join(waiters, `${pid}.json`))) await pause(30);
  fs.writeFileSync(path.join(waiters, `${pid}.claim.json`), JSON.stringify({ token: "dead-holder", pr: "9", restore: null }));
  while (!fs.existsSync(path.join(waiters, `${pid}.ack.json`))) await pause(30);
  // The holder dies without a result: its lock goes.
  fs.rmSync(lock, { recursive: true, force: true });
  const r = await run.done;
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /took PR 5 into its batch/);
  assert.match(r.out, /batch ended without a result for this PR; back in the queue/);
  assert.equal(t.tea().prs["5"].merged, true);
  assert.equal(fs.existsSync(path.join(waiters, `${pid}.claim.json`)), false);
});

test("a single landing runs the prepare hook on the merge, and lands what it committed", async () => {
  // The branch picked m-2; main took m-2 meanwhile.
  const t = setup({ 1: { "m-2-one.txt": "pr 1\n" } }, { main: { "m-1-main.txt": "main\n", "m-2-main.txt": "main\n" } });
  const r = await t.land("1", t.prepareEnv).done;
  assert.equal(r.status, 0, r.out);
  const [run] = t.preparesRun();
  assert.equal(run.base, t.git(t.wt["1"], "--git-dir", t.origin, "rev-parse", "main^1"), "the base is main as merged, before the PR");
  assert.equal(t.git(t.wt["1"], "rev-parse", `${run.head}^2`), run.base, "the hook runs on the merge of that base");
  assert.deepEqual(t.mainFiles(), [".gitignore", "a.txt", "m-1-main.txt", "m-2-main.txt", "m-3-one.txt"]);
  assert.equal(t.mainText("m-3-one.txt"), "pr 1");
  const [checked] = t.checksRun();
  assert.equal(t.merges()[0].body.head_commit_id, checked.head, "the hook's commit is the head checked and merged");
  assert.equal(t.mainTree(), checked.tree);
  assert.match(r.out, /\$ git merge --no-edit -m Merge origin\/main \([0-9a-f]{7}\) into pr-1 [0-9a-f]{40}/);
});

test("a batch runs each member's prepare hook against the batch so far", async () => {
  // All three picked m-1: main has none, so the first keeps it and the next two move past.
  const t = setup({
    1: { ...prFiles(1), "m-1-one.txt": "pr 1\n" },
    2: { ...prFiles(2), "m-1-two.txt": "pr 2\n" },
    3: { ...prFiles(3), "m-1-three.txt": "pr 3a\n", "m-4-three.txt": "pr 3b\n" },
  });
  const env = { 1: t.prepareEnv, 2: t.prepareEnv, 3: t.prepareEnv };
  const r = await results(await t.queueAll(["1", "2", "3"], env));
  for (const n of ["1", "2", "3"]) assert.equal(r[n].status, 0, r[n].out);
  assert.equal(t.checksRun().length, 1, "one check run for the batch");
  const runs = t.preparesRun();
  assert.deepEqual(runs.map((p) => p.cwd), [t.wt["2"], t.wt["3"], t.wt["1"]], "chain order: waiters, then the holder");
  const merges = t.merges();
  assert.equal(runs[1].base, merges[0].body.head_commit_id, "the second member's base is the first's checked head");
  assert.equal(runs[2].base, merges[1].body.head_commit_id);
  // Numbers rise in landing order: #2 keeps m-1; #3's m-1 moves past it and its m-4 stays above;
  // the holder #1 lands last, past both.
  const migrations = t.mainFiles().filter((f) => f.startsWith("m-"));
  assert.deepEqual(migrations, ["m-1-two.txt", "m-2-three.txt", "m-4-three.txt", "m-5-one.txt"]);
  assert.equal(t.mainTree(), t.checksRun()[0].tree, "main ends on the checked tree");
});

test("a failing prepare hook drops its member from the batch and refuses it alone; the rest land", async () => {
  const t = setup({ 1: prFiles(1), 2: { ...prFiles(2), "hookfail.txt": "x\n" }, 3: prFiles(3) });
  const env = { 1: t.prepareEnv, 2: t.prepareEnv, 3: t.prepareEnv };
  const r = await results(await t.queueAll(["1", "2", "3"], env));
  assert.equal(r["1"].status, 0, r["1"].out);
  assert.equal(r["3"].status, 0, r["3"].out);
  assert.equal(r["2"].status, 1, r["2"].out);
  assert.match(r["2"].out, /land: PR #2 leaves the batch: LAND_PREPARE_CMD failed/);
  assert.match(r["2"].out, /land: refused: LAND_PREPARE_CMD failed; the tree is put back on the merge/);
  assert.equal(t.checksRun().length, 1, "the batch of #3 and #1; #2 refuses before any check");
  assert.deepEqual(t.mainFiles(), [".gitignore", "a.txt", "pr-1.txt", "pr-3.txt"]);
  assert.equal(t.git(t.wt["2"], "status", "--porcelain", "--untracked-files=no"), "", "#2's worktree is left clean");
});

test("a prepare hook that leaves changes uncommitted refuses the landing", async () => {
  const t = setup({ 1: { ...prFiles(1), "hookdirty.txt": "x\n" } });
  const r = await t.land("1", t.prepareEnv).done;
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /land: refused: LAND_PREPARE_CMD left uncommitted changes/);
  assert.equal(t.checksRun().length, 0);
  assert.equal(t.git(t.wt["1"], "status", "--porcelain", "--untracked-files=no"), "");
  assert.equal(t.tea().prs["1"].merged, false);
});

// --- The after hook (lexicontent #1768): LAND_AFTER_CMD set ---

// An after hook that appends its cwd and LAND_AFTER_* to a file, and exits with `code`.
const afterHook = (t, code = 0) => {
  const script = path.join(t.dir, "after.cjs");
  const out = path.join(t.dir, "after.jsonl");
  fs.writeFileSync(
    script,
    `require("node:fs").appendFileSync(${JSON.stringify(out)}, JSON.stringify({ cwd: process.cwd(), prs: process.env.LAND_AFTER_PRS, main: process.env.LAND_AFTER_MAIN }) + "\\n"); process.exit(${code});`,
  );
  const runs = () => (fs.existsSync(out) ? fs.readFileSync(out, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
  return { env: { LAND_AFTER_CMD: `"${node}" "${script}"` }, runs };
};

test("after hook: a batch runs it once, in the holder's worktree, with every PR it merged and main after them", async () => {
  const t = setup({ 1: prFiles(1), 2: prFiles(2), 3: prFiles(3) });
  const h = afterHook(t);
  const r = await results(await t.queueAll(["1", "2", "3"], { 1: h.env, 2: h.env, 3: h.env }));
  for (const n of ["1", "2", "3"]) assert.equal(r[n].status, 0, r[n].out);
  const runs = h.runs();
  assert.equal(runs.length, 1, "once per run, not per PR");
  assert.equal(path.resolve(runs[0].cwd), path.resolve(t.wt["1"]));
  assert.equal(runs[0].prs, "2 3 1", "merge order");
  assert.equal(runs[0].main, t.git(t.wt["1"], "--git-dir", t.origin, "rev-parse", "main"));
});

test("after hook: its failure is printed and the landing still exits 0", async () => {
  const t = setup({ 1: prFiles(1) });
  const h = afterHook(t, 3);
  const r = await t.land("1", h.env).done;
  assert.equal(r.status, 0, r.out);
  assert.equal(h.runs().length, 1);
  assert.match(r.out, /land: LAND_AFTER_CMD failed \(exit 3\); the landing stands/);
  assert.equal(t.tea().prs["1"].merged, true);
});

test("after hook: a run that merges nothing doesn't run it", async () => {
  const t = setup({ 1: { ...prFiles(1), "hookdirty.txt": "x\n" } });
  const h = afterHook(t);
  const r = await t.land("1", { ...t.prepareEnv, ...h.env }).done;
  assert.equal(r.status, 1, r.out);
  assert.equal(h.runs().length, 0);
});

test("after hook: a batch that stops partway passes only the PRs that merged, then those landed alone", async () => {
  const t = setup({ 1: prFiles(1), 2: { ...prFiles(2), "fail-alpha.txt": "x\n" }, 3: prFiles(3) }, { hook: true });
  const h = afterHook(t);
  const r = await results(await t.queueAll(["1", "2", "3"], { 1: h.env, 2: h.env, 3: h.env }));
  assert.equal(r["2"].status, 1, r["2"].out);
  const runs = h.runs();
  assert.equal(runs.length, 1);
  assert.deepEqual(runs[0].prs.split(" ").sort(), ["1", "3"], "#2 didn't merge, so it isn't relayed");
});

// --- Culprits (D1763): LAND_CULPRIT_CMD set ---

const noteOf = (t, n) => t.logRows().find((row) => row[1] === n)[7];

test("culprit: one PR's failing test drops it, and the rest is checked once more and lands", async () => {
  const t = setup({ 1: prFiles(1), 2: { ...prFiles(2), "fail-alpha.txt": "x\n" }, 3: prFiles(3) }, { hook: true });
  const r = await results(await t.queueAll(["1", "2", "3"]));
  assert.equal(r["1"].status, 0, r["1"].out);
  assert.equal(r["3"].status, 0, r["3"].out);
  assert.equal(r["2"].status, 1, r["2"].out);
  assert.match(r["2"].out, /land: PR #2 leaves the batch: its .*check\.mjs.* failed in alpha \(log .*\), which points at this PR/);
  assert.equal(t.checksRun().length, 2, "the batch, then the rest once");
  assert.deepEqual(t.checksRun()[1].files, [".gitignore", "a.txt", "pr-1.txt", "pr-3.txt"]);
  assert.deepEqual(t.mainFiles(), [".gitignore", "a.txt", "pr-1.txt", "pr-3.txt"]);
  assert.equal(t.mainTree(), t.checksRun()[1].tree, "main ends on the re-checked tree");
  assert.equal(t.tea().prs["2"].merged, false);
  assert.match(t.comments("2").join("\n"), /^land: PR #2 did not land[\s\S]*failed in alpha/);
  assert.deepEqual(t.comments("1"), []);
  assert.match(noteOf(t, "1"), /^culprit #2: alpha; #3, #1 passed$/);
  assert.equal(t.runLogs().length, 2, "each run keeps its own log");
});

test("culprit: with a prepare hook, the rest is renumbered afresh without the culprit's migrations", async () => {
  // All picked m-1. The first chain (2, 3, 1) renumbers 3 and 1 past #2's m-1; once #2 leaves,
  // the rest is rebuilt from the branches' own heads and renumbered against main alone.
  const t = setup(
    {
      1: { ...prFiles(1), "m-1-one.txt": "pr 1\n" },
      2: { ...prFiles(2), "m-1-two.txt": "pr 2\n", "fail-alpha.txt": "x\n" },
      3: { ...prFiles(3), "m-1-three.txt": "pr 3\n" },
    },
    { hook: true },
  );
  const env = { 1: t.prepareEnv, 2: t.prepareEnv, 3: t.prepareEnv };
  const r = await results(await t.queueAll(["1", "2", "3"], env));
  assert.equal(r["1"].status, 0, r["1"].out);
  assert.equal(r["3"].status, 0, r["3"].out);
  assert.equal(r["2"].status, 1, r["2"].out);
  const checked = t.checksRun();
  assert.equal(checked.length, 2);
  assert.ok(checked[0].files.includes("m-3-one.txt"), "the first chain renumbered past #2's m-1");
  assert.deepEqual(t.mainFiles().filter((f) => f.startsWith("m-")), ["m-1-three.txt", "m-2-one.txt"]);
  assert.equal(t.mainTree(), checked[1].tree, "main ends on the re-checked tree");
  assert.equal(t.preparesRun().length, 5, "three for the chain, then two for the rest");
  for (const n of ["1", "2", "3"]) assert.equal(t.git(t.wt[n], "status", "--porcelain", "--untracked-files=no"), "");
});

test("culprit: two culprits leave together, and the other two land on one more run", async () => {
  const t = setup(
    { 1: prFiles(1), 2: { ...prFiles(2), "fail-alpha.txt": "x\n" }, 3: { ...prFiles(3), "fail-beta.txt": "x\n" }, 4: prFiles(4) },
    { hook: true, batchMax: 4 },
  );
  const r = await results(await t.queueAll(["1", "2", "3", "4"]));
  for (const n of ["1", "4"]) assert.equal(r[n].status, 0, r[n].out);
  assert.match(r["2"].out, /leaves the batch: its .* failed in alpha \(/);
  assert.match(r["3"].out, /leaves the batch: its .* failed in beta \(/);
  for (const n of ["2", "3"]) assert.equal(r[n].status, 1, r[n].out);
  assert.equal(t.checksRun().length, 2);
  assert.deepEqual(t.mainFiles(), [".gitignore", "a.txt", "pr-1.txt", "pr-4.txt"]);
  assert.match(noteOf(t, "1"), /^culprit #2, #3: alpha, beta/);
});

test("culprit: an unattributed failure splits the batch in halves, the holder's half first", async () => {
  const t = setup({ 1: prFiles(1), 2: { ...prFiles(2), "combo-a.txt": "x\n" }, 3: { ...prFiles(3), "combo-b.txt": "x\n" } }, { hook: true });
  const r = await results(await t.queueAll(["1", "2", "3"]));
  // Chain 2, 3, 1: halves (3, 1) then (2). (3, 1) passes and lands; 2 on top of it fails: refused.
  assert.equal(r["1"].status, 0, r["1"].out);
  assert.equal(r["3"].status, 0, r["3"].out);
  assert.equal(r["2"].status, 1, r["2"].out);
  assert.match(r["1"].out, /not attributed \(no member touches combo\); checking it in halves, \(#3, #1\) then \(#2\)/);
  assert.match(r["2"].out, /land: refused: .*check\.mjs.* failed in combo/);
  const checked = t.checksRun();
  assert.equal(checked.length, 3, "the batch, then each half once");
  assert.equal(checked[1].cwd, t.wt["1"]);
  assert.equal(checked[2].cwd, t.wt["2"]);
  assert.deepEqual(t.mainFiles(), [".gitignore", "a.txt", "combo-b.txt", "pr-1.txt", "pr-3.txt"]);
  assert.match(noteOf(t, "1"), /^unattributed \(no member touches combo\): halves; #3, #1 passed; #2 failed again$/);
  assert.equal(t.comments("2").length, 1);
});

test("culprit: the holder itself is the culprit; the waiters land on their own re-check", async () => {
  const t = setup({ 1: { ...prFiles(1), "fail-alpha.txt": "x\n" }, 2: prFiles(2), 3: prFiles(3) }, { hook: true });
  const r = await results(await t.queueAll(["1", "2", "3"]));
  assert.equal(r["1"].status, 1, r["1"].out);
  assert.match(r["1"].out, /land: PR #1 leaves the batch: its .* failed in alpha/);
  for (const n of ["2", "3"]) assert.equal(r[n].status, 0, r[n].out);
  const checked = t.checksRun();
  assert.equal(checked.length, 2);
  assert.equal(checked[1].cwd, t.wt["3"], "the rest is checked in its last member's worktree");
  assert.deepEqual(t.mainFiles(), [".gitignore", "a.txt", "pr-2.txt", "pr-3.txt"]);
  assert.equal(t.mainTree(), checked[1].tree);
  assert.equal(t.git(t.wt["1"], "rev-parse", "HEAD"), t.git(t.wt["1"], "rev-parse", "origin/pr-1"), "the holder's worktree is put back");
  assert.equal(t.comments("1").length, 1);
});

test("culprit: when the rest fails its re-check too, each of the rest lands alone", async () => {
  // Run 1 shows only alpha (PR 2); the combo of PRs 3 and 1 shows on the rest's re-check.
  const t = setup(
    { 1: { ...prFiles(1), "combo-b.txt": "x\n" }, 2: { ...prFiles(2), "fail-alpha.txt": "x\n" }, 3: { ...prFiles(3), "combo-a.txt": "x\n" } },
    { hook: true },
  );
  const r = await results(await t.queueAll(["1", "2", "3"]));
  assert.equal(r["2"].status, 1, r["2"].out);
  // Alone in queue order: the holder first, then PR 3 on top of it, which brings the combo back.
  assert.equal(r["1"].status, 0, r["1"].out);
  assert.equal(r["3"].status, 1, r["3"].out);
  assert.match(r["1"].out, /#3, #1 failed again: .* failed in combo .*; landing PR #1 alone/);
  assert.match(r["3"].out, /land: refused: .* failed in combo/);
  assert.equal(t.checksRun().length, 4, "the batch, the rest, then 1 and 3 alone");
  assert.deepEqual(t.mainFiles(), [".gitignore", "a.txt", "combo-b.txt", "pr-1.txt"]);
  assert.match(noteOf(t, "1"), /culprit #2: alpha; #3, #1 failed again/);
});

test("culprit: a half that names its culprit drops it with no run of its own, and the rest of the half lands", async () => {
  // Chain 2, 3, 4, 1. Run 1 also fails "any", pinned on every member: halves (4, 1) then (2, 3).
  // (4, 1) fails alpha, which is #4's: #4 leaves unrun and #1 is checked alone (#1834).
  const t = setup(
    { 1: prFiles(1), 2: prFiles(2), 3: { ...prFiles(3), "any-a.txt": "x\n" }, 4: { ...prFiles(4), "any-b.txt": "x\n", "fail-alpha.txt": "x\n" } },
    { hook: true, batchMax: 4 },
  );
  const r = await results(await t.queueAll(["1", "2", "3", "4"]));
  for (const n of ["1", "2", "3"]) assert.equal(r[n].status, 0, r[n].out);
  assert.equal(r["4"].status, 1, r["4"].out);
  assert.match(r["4"].out, /land: PR #4 leaves the batch: its .* failed in alpha \(log .*\), which points at this PR/);
  assert.match(r["1"].out, /#4, #1's .* which points at #4; checking #1 again without it/);
  const checked = t.checksRun();
  assert.equal(checked.length, 4, "the batch, (4, 1), (1), then (2, 3): no run of #4 alone");
  assert.ok(checked.every((c) => c.cwd !== t.wt["4"]), "#4 is never checked on its own");
  assert.deepEqual(t.mainFiles(), [".gitignore", "a.txt", "any-a.txt", "pr-1.txt", "pr-2.txt", "pr-3.txt"]);
  assert.match(noteOf(t, "1"), /^unattributed \(every member is a suspect\): halves; #4, #1 failed again; culprit #4: alpha; #1 passed; #2, #3 passed$/);
  assert.equal(t.comments("4").length, 1);
});

test("culprit: an infrastructure failure runs the same tree once more before anyone leaves", async () => {
  const t = setup({ 1: prFiles(1), 2: prFiles(2) }, { hook: true });
  const marker = path.join(t.dir, "infra-once");
  const r = await results(await t.queueAll(["1", "2"], { 1: { CHECK_INFRA_ONCE: marker } }));
  for (const n of ["1", "2"]) assert.equal(r[n].status, 0, r[n].out);
  const checked = t.checksRun();
  assert.equal(checked.length, 2);
  assert.equal(checked[0].tree, checked[1].tree, "the retry checks the same tree");
  assert.match(r["1"].out, /failed on boom; running the same tree once more/);
  assert.match(noteOf(t, "1"), /^retried #2, #1: boom$/);
  assert.equal(t.runLogs().length, 2);
});

// A second generated-file pair (LAND_REGEN_PATHS_<NAME>), like a skills lock re-synced on conflict.
const lockPair = (t) => {
  const sync = path.join(t.dir, "fixtures", "sync.mjs");
  fs.writeFileSync(sync, `import fs from "node:fs"; fs.writeFileSync("lock.json", "synced\n");`);
  return {
    LAND_REGEN_PATHS: "gen.txt",
    LAND_REGEN_CMD: `"${node}" "${path.join(t.dir, "fixtures", "regen.mjs")}"`,
    LAND_REGEN_PATHS_SKILLS: "lock.json",
    LAND_REGEN_CMD_SKILLS: `"${node}" "${sync}"`,
  };
};

test("a conflict only in a second pair's files runs that pair's command alone, and lands", async () => {
  const t = setup({ 1: { ...prFiles(1), "lock.json": "pr\n" } }, { main: { "lock.json": "main\n" } });
  const r = await t.land("1", lockPair(t)).done;
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /only generated files conflict \(lock\.json\)/);
  assert.equal(t.mainText("lock.json"), "synced");
  assert.ok(!t.mainFiles().includes("gen.txt"), "the first pair's command did not run");
});

test("a second pair's file conflicting beside any other file still refuses", async () => {
  const t = setup({ 1: { "lock.json": "pr\n", "x.txt": "pr\n" } }, { main: { "lock.json": "main\n", "x.txt": "main\n" } });
  const r = await t.land("1", lockPair(t)).done;
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /land: refused: merging origin\/main conflicts \(lock\.json, x\.txt\)/);
  assert.equal(t.merges().length, 0);
});
