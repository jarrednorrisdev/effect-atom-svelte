#!/usr/bin/env node
// Runs a repo's Land command so only one landing runs at a time per repo on this machine,
// and logs each landing's wait and run time.
//
//   node land-lock.mjs --pr <n> [--max-wait <seconds>] -- <land command...>
//   node land-lock.mjs --stats [--days <n>]
//
// The lock and the log live in the repo's git common dir, so every worktree shares them;
// JND_LAND_DIR puts them in another folder (the tests use a temp one). Waiters take the lock in
// the order they began waiting, and a killed waiter drops out of that order within a minute.
// A waiter prints a line each time the holder, the count of landings waiting beside it or its
// place in the queue changes.
// A lock is stale when its owner's pid is dead or its beat is older than STALE_MS, never for how
// long its landing has run.
// A Land command that batches (land-forgejo.mjs, D294) can take waiters into its own landing: a
// waiter it claims answers, waits for its result without a max-wait, and exits with its own PR's
// code, logged with 0 check runs.
// Exit codes: the Land command's own (or, for a batched waiter, its PR's), 130 when a signal
// stopped it, 75 when the lock stayed busy past --max-wait (default 300 s), 2 for bad arguments.

import { execFileSync, spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const dash = args.indexOf("--");
const opts = dash === -1 ? args : args.slice(0, dash);
const command = dash === -1 ? [] : args.slice(dash + 1);
const flag = (name, fallback) => {
  const i = opts.indexOf(name);
  return i === -1 ? fallback : opts[i + 1];
};

const commonDir = path.resolve(
  process.env.JND_LAND_DIR || execFileSync("git", ["rev-parse", "--git-common-dir"], { encoding: "utf8" }).trim(),
);
const lockDir = path.join(commonDir, "jnd-land.lock");
const logFile = path.join(commonDir, "jnd-land-log.tsv");
const ownerFile = path.join(lockDir, "owner.json");
// Ten beats, so a holder on a loaded machine that misses a few, or whose rename a reader blocks,
// keeps its lock.
const STALE_MS = 5 * 60 * 1000;
const BEAT_MS = Number(process.env.JND_LAND_BEAT_MS) || 30 * 1000;
// A landing writes owner.json just after creating the lock folder; a folder still without one
// after this long belongs to a landing killed between the two.
const OWNERLESS_GRACE_MS = 10 * 1000;

const median = (xs) => {
  if (xs.length === 0) return "-";
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

if (opts.includes("--stats")) {
  const days = Number(flag("--days", 7));
  const since = Date.now() - days * 86400000;
  const rows = fs.existsSync(logFile)
    ? fs.readFileSync(logFile, "utf8").trim().split("\n").slice(1).map((l) => l.split("\t"))
    : [];
  const recent = rows.filter(([at]) => Date.parse(at) >= since);
  const ran = recent.filter((r) => r[4] !== "busy");
  const landed = new Set(ran.filter((r) => r[4] === "0").map((r) => r[1]));
  const attempts = new Map();
  for (const r of ran) attempts.set(r[1], (attempts.get(r[1]) ?? 0) + 1);
  const retried = [...attempts.values()].filter((n) => n > 1).length;
  // A row before batches (D294) has no runs column: it was one check run.
  const checkRuns = ran.reduce((n, r) => n + (r[6] === undefined || r[6] === "" ? 1 : Number(r[6])), 0);
  const perPr = landed.size ? (checkRuns / landed.size).toFixed(2) : "-";
  console.log(`last ${days} days: ${landed.size} PRs landed, ${ran.length} runs, ${recent.length - ran.length} busy timeouts`);
  console.log(`median wait ${median(ran.map((r) => Number(r[2])))} s, median run ${median(ran.map((r) => Number(r[3])))} s`);
  console.log(`failed runs ${ran.filter((r) => r[4] !== "0").length}, PRs that needed more than one run ${retried}`);
  console.log(`check runs ${checkRuns}, ${perPr} per landed PR; landings that rode in a batch ${ran.filter((r) => r[7]?.startsWith("batched")).length}`);
  // land-forgejo's culprit notes (D1763).
  const noted = (re) => ran.filter((r) => re.test(r[7] ?? "")).length;
  console.log(
    `failed batches: ${noted(/culprit #/)} attributed, ${noted(/unattributed/)} split in halves; ${noted(/failed again/)} with a part that failed again; landings with a check run retried on infrastructure or a known flake: ${noted(/retried/)}`,
  );
  process.exit(0);
}

const pr = flag("--pr");
const maxWait = Number(flag("--max-wait", 300)) * 1000;
if (!pr || command.length === 0 || Number.isNaN(maxWait)) {
  console.error("usage: node land-lock.mjs --pr <n> [--max-wait <seconds>] -- <land command...>");
  process.exit(2);
}

// runs: the check runs this landing made (0 for one that rode in another's batch); note: anything
// the log must show, such as a batch that stopped with main on an unchecked prefix.
const log = (waitS, runS, result, runs = "", note = "") => {
  if (!fs.existsSync(logFile)) fs.writeFileSync(logFile, "at\tpr\twait_s\trun_s\texit\thost\truns\tnote\n");
  const clean = String(note).replace(/[\t\n]/g, " ");
  fs.appendFileSync(logFile, `${new Date().toISOString()}\t${pr}\t${waitS}\t${runS}\t${result}\t${os.hostname()}\t${runs}\t${clean}\n`);
};

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
};

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// A lock folder's owner (null when owner.json is missing or unreadable), its age, and an id that
// differs once another landing has replaced the folder. The id leaves out the mtime: a rename can
// change a folder's mtime on some file systems.
const inspect = (dir) => {
  let stat;
  try {
    // A Number inode loses its low digits on some volumes, so two folders could share an id.
    stat = fs.statSync(dir, { bigint: true });
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
  let text = null;
  try {
    text = fs.readFileSync(path.join(dir, "owner.json"), "utf8");
  } catch {}
  let owner = null;
  try {
    owner = JSON.parse(text);
  } catch {}
  return { owner, ageMs: Date.now() - Number(stat.mtimeMs), id: `${stat.ino}:${text}` };
};

// The beat catches a dead holder whose pid Windows has given to another process. An owner with no
// beat (written by an older land-lock) makes the subtraction NaN, so it is judged by its pid alone.
const isStale = ({ owner, ageMs }) =>
  owner ? !alive(owner.pid) || Date.now() - owner.beat > STALE_MS : ageMs > OWNERLESS_GRACE_MS;

const olderThanGrace = (p) => {
  try {
    return Date.now() - fs.statSync(p).mtimeMs > OWNERLESS_GRACE_MS;
  } catch {
    return false;
  }
};

// Holds a waiter at each step of a takeover, so the tests can race waiters through it.
const pause = () => {
  const ms = Number(process.env.JND_LAND_TAKEOVER_PAUSE_MS);
  if (ms) sleep(ms);
};

// Claims the stale lock with a folder inside it, so only one of the waiters that judged it stale
// takes it, and checks under the claim that the lock is still the one it judged before moving it
// to a name of its own and deleting it. The lock path never stands empty while a live lock exists.
// A claim older than the grace was left by a waiter killed mid-takeover: it is cleared for the next
// try. Clearing it touches the lock folder's mtime, so an ownerless lock then waits one more grace.
// True when the lock folder is gone.
const takeOver = (seen) => {
  const claim = path.join(lockDir, "takeover");
  try {
    fs.mkdirSync(claim);
  } catch (e) {
    if (e.code === "ENOENT") return true;
    if (e.code === "EEXIST" && olderThanGrace(claim)) fs.rmSync(claim, { recursive: true, force: true });
    return false;
  }
  if (inspect(lockDir)?.id !== seen.id) {
    fs.rmSync(claim, { recursive: true, force: true });
    return false;
  }
  pause();
  const moved = `${lockDir}.stale-${process.pid}-${crypto.randomUUID()}`;
  try {
    fs.renameSync(lockDir, moved);
  } catch {
    fs.rmSync(claim, { recursive: true, force: true });
    return false;
  }
  fs.rmSync(moved, { recursive: true, force: true });
  return true;
};

// Clears folders a takeover moved aside and was killed before deleting, and the report files of
// earlier holders killed before reading theirs (it runs just after taking the lock, so none is live).
const sweep = () => {
  const prefix = `${path.basename(lockDir)}.stale-`;
  try {
    for (const name of fs.readdirSync(commonDir)) {
      const p = path.join(commonDir, name);
      if (name.startsWith(prefix) && olderThanGrace(p)) fs.rmSync(p, { recursive: true, force: true });
      if (name.startsWith("jnd-land-report-")) fs.rmSync(p, { force: true });
    }
  } catch {}
};

// A token, not the pid, says whose lock it is: Windows soon reuses a dead holder's pid.
const token = crypto.randomUUID();
let held;

// Through a temp file and a rename, so a waiter never reads a truncated owner file and judges a
// live lock ownerless.
const writeOwner = (owner) => {
  const temp = `${ownerFile}.${token}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(owner));
  fs.renameSync(temp, ownerFile);
};

const tryLock = () => {
  try {
    fs.mkdirSync(lockDir);
    const now = Date.now();
    held = { pid: process.pid, pr, token, started: now, beat: now };
    writeOwner(held);
    sweep();
    return true;
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
    const seen = inspect(lockDir);
    if (!seen) return tryLock();
    if (!isStale(seen)) return seen.owner;
    pause();
    console.error(
      seen.owner
        ? `land-lock: clearing a stale lock from PR ${seen.owner.pr} (pid ${seen.owner.pid})`
        : "land-lock: clearing a lock with no owner file",
    );
    return takeOver(seen) ? tryLock() : seen.owner;
  }
};

// Each waiter's ticket: a file here holding when it began waiting, rewritten at each poll so the
// others can tell it still waits. A waiter tries the lock only when no live ticket is older than
// its own, so landings take the lock in the order they began waiting.
const waitersDir = path.join(commonDir, "jnd-land-waiters");
const waiterFile = path.join(waitersDir, `${process.pid}.json`);
const start = Date.now();
const leaveQueue = () => fs.rmSync(waiterFile, { force: true });
// The ticket also says where and what this landing runs, and its LAND_* settings, so the holder can
// take it into a batch (land-forgejo.mjs, D294).
const landSettings = Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith("LAND_")));
const joinQueue = () => {
  fs.mkdirSync(waitersDir, { recursive: true });
  fs.writeFileSync(
    waiterFile,
    JSON.stringify({ pid: process.pid, pr, since: start, polled: Date.now(), cwd: process.cwd(), command, env: landSettings }),
  );
};
// A killed waiter leaves its file, and Windows soon gives its pid to another process, so a file
// no poll has rewritten for a minute (a poll sleeps at most 5 s) counts as dead whatever its pid.
// That keeps a dead ticket from holding up the queue for longer than a minute.
const WAITER_MAX_AGE_MS = 60 * 1000;
const POLL_MS = Number(process.env.JND_LAND_POLL_MS) || 5000;
const before = (a, b) => a.since < b.since || (a.since === b.since && a.pid < b.pid);
// The other live waiters, and how many of them began waiting before this one; a dead one's file
// is deleted. A file with no start time (an older land-lock) is counted but never ahead.
const otherWaiters = () => {
  let names = [];
  try {
    names = fs.readdirSync(waitersDir);
  } catch {}
  let count = 0;
  let ahead = 0;
  for (const name of names) {
    // A batch's claim, answer and result files outlive a waiter that died: cleared once its ticket
    // is gone and they are a minute old.
    const aux = name.match(/^(\d+)\.(claim|ack|result)\.json$/);
    if (aux) {
      const p = path.join(waitersDir, name);
      if (Number(aux[1]) !== process.pid && !names.includes(`${aux[1]}.json`)) {
        try {
          if (Date.now() - fs.statSync(p).mtimeMs >= WAITER_MAX_AGE_MS) fs.rmSync(p, { force: true });
        } catch {}
      }
      continue;
    }
    const pid = Number(path.basename(name, ".json"));
    if (pid === process.pid || !Number.isInteger(pid)) continue;
    const file = path.join(waitersDir, name);
    let ageMs = 0;
    let since;
    // A ticket caught mid-write can't be read: it counts as ahead for this poll, so a reader never
    // jumps a landing that began waiting first (a batch test flaked on exactly that).
    let unreadable = false;
    try {
      ageMs = Date.now() - fs.statSync(file).mtimeMs;
      since = JSON.parse(fs.readFileSync(file, "utf8")).since;
    } catch {
      unreadable = true;
    }
    if (!alive(pid) || ageMs >= WAITER_MAX_AGE_MS) {
      fs.rmSync(file, { force: true });
      continue;
    }
    count += 1;
    if (unreadable || (Number.isFinite(since) && before({ since, pid }, { since: start, pid: process.pid }))) ahead += 1;
  }
  return { count, ahead };
};

const minutes = (ms) => `${Math.max(0, Math.round(ms / 60000))} min`;
// A line for each change of holder, of the waiters' count or of this waiter's place, so a long
// wait shows who holds it now.
const describeWait = (owner, { count, ahead }) => {
  const holder = owner
    ? `PR ${owner.pr}'s landing (pid ${owner.pid}, holding it ${minutes(Date.now() - owner.started)})`
    : owner === null
      ? "a landing that has not written its owner file yet"
      : "the landing ahead of it in the queue";
  const queue = count === 0 ? "" : `; ${count} other landing${count === 1 ? "" : "s"} wait${count === 1 ? "s" : ""} too`;
  const place = ahead === 0 ? "" : `, ${ahead} ahead of it`;
  return {
    key: `${owner?.pr}:${owner?.pid}:${count}:${ahead}`,
    line: `land-lock: waiting for ${holder}${queue}${place}`,
  };
};

// A batch (D294): the holder writes `<pid>.claim.json` with its lock token; this waiter answers
// with `<pid>.ack.json`, stops trying the lock and the max-wait, and waits for `<pid>.result.json`,
// which carries this PR's exit code and lines. A claim whose holder no longer holds the lock, with
// no result written, is void: the worktree goes back to the head the claim names and the waiter
// rejoins the queue in its old place.
const claimFile = path.join(waitersDir, `${process.pid}.claim.json`);
const ackFile = path.join(waitersDir, `${process.pid}.ack.json`);
const resultFile = path.join(waitersDir, `${process.pid}.result.json`);
// Null when the file is missing; undefined when it can't be read just now (a rename in flight).
const readJson = (f) => {
  try {
    return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch (e) {
    return e.code === "ENOENT" ? null : undefined;
  }
};
// The holder's lock is gone, someone else's, or stale by isStale's rules (a dead pid, or a beat
// past STALE_MS, which catches a dead holder whose pid Windows gave to another process).
const holderGone = (claim) => {
  const seen = inspect(lockDir);
  if (!seen) return true;
  if (!seen.owner) return false;
  return seen.owner.token !== claim.token || isStale(seen);
};
const voidClaim = (claim) => {
  const sha = claim?.restore;
  if (sha && /^[0-9a-f]{40,64}$/.test(sha)) {
    spawnSync("git", ["merge", "--abort"], { stdio: "ignore" });
    const head = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout?.trim();
    if (head !== sha) {
      console.error(`land-lock: putting this worktree back at ${sha.slice(0, 7)}, where the batch found it`);
      spawnSync("git", ["reset", "--hard", sha], { stdio: "inherit" });
    }
  }
  fs.rmSync(claimFile, { force: true });
  fs.rmSync(ackFile, { force: true });
};
const finishFromBatch = (result, claimedAt) => {
  console.error(`land-lock: PR ${pr} rode in PR ${result.holder}'s batch; its check output is in that landing's log`);
  for (const line of result.lines ?? []) console.log(line);
  for (const f of [claimFile, ackFile, resultFile]) fs.rmSync(f, { force: true });
  leaveQueue();
  const code = Number.isInteger(result.code) ? result.code : 1;
  log(Math.round((claimedAt - start) / 1000), Math.round((Date.now() - claimedAt) / 1000), code, 0, `batched in PR ${result.holder}`);
  process.exit(code);
};

let lastKey = null;
let lastOwner = null;
let claimed = null;
let claimedAt = 0;
for (;;) {
  joinQueue();
  if (claimed) {
    const result = readJson(resultFile);
    if (result) finishFromBatch(result, claimedAt);
    const claim = readJson(claimFile);
    if (claim === null || (claim && claim.token !== claimed.token) || holderGone(claimed)) {
      const late = readJson(resultFile);
      if (late) finishFromBatch(late, claimedAt);
      voidClaim(claim ?? claimed);
      console.error(`land-lock: PR ${claimed.pr}'s batch ended without a result for this PR; back in the queue`);
      claimed = null;
      lastKey = null;
      continue;
    }
    if (claim) claimed = claim;
    sleep(Math.min(POLL_MS, 1000));
    continue;
  }
  const claim = readJson(claimFile);
  if (claim) {
    if (holderGone(claim)) {
      voidClaim(claim);
    } else {
      fs.writeFileSync(ackFile, JSON.stringify({ token: claim.token }));
      claimed = claim;
      claimedAt = Date.now();
      console.error(`land-lock: PR ${claim.pr}'s landing took PR ${pr} into its batch; waiting for its result`);
      continue;
    }
  }
  const waiters = otherWaiters();
  // Undefined: no lock folder, so a waiter ahead is due to take it.
  let owner;
  if (waiters.ahead === 0) {
    const got = tryLock();
    if (got === true) break;
    owner = got;
  } else {
    owner = inspect(lockDir)?.owner;
  }
  if (owner) lastOwner = owner;
  const wait = describeWait(owner, waiters);
  if (wait.key !== lastKey) console.error(wait.line);
  lastKey = wait.key;
  if (Date.now() - start > maxWait) {
    leaveQueue();
    log(Math.round((Date.now() - start) / 1000), 0, "busy");
    const holder = lastOwner ? `PR ${lastOwner.pr}'s landing holds it` : "another landing holds it";
    console.error(`land-lock: still busy after ${Math.round((Date.now() - start) / 1000)} s (${holder}); run the same command again`);
    process.exit(75);
  }
  sleep(Math.min(POLL_MS, Math.max(100, maxWait - (Date.now() - start))));
}
leaveQueue();

const ours = () => {
  try {
    return JSON.parse(fs.readFileSync(ownerFile, "utf8")).token === token;
  } catch {
    return false;
  }
};
// Frees the lock only while it is this landing's, so one that lost it can't free the next holder's.
const release = () => {
  if (ours()) fs.rmSync(lockDir, { recursive: true, force: true });
};
// A failed beat is skipped, since an exception here would end the landing: on Windows a waiter
// reading owner.json can make the rename fail.
const beat = setInterval(() => {
  try {
    if (ours()) writeOwner({ ...held, beat: Date.now() });
  } catch {}
}, BEAT_MS);

// The landing goes on until the child exits, so the lock is released and the run logged only after
// that, below. On Windows the kill can't be a signal: it ends only the child, abruptly, and it can
// beat the child's own tree kill, leaving the check running and holding a heavy slot.
let child;
let signalled = false;
// Installed only once the lock is held: a listener replaces the default exit, and the wait loop
// above never yields to the event loop, so a listener there would swallow a Ctrl-C and the
// cancelled waiter would go on to land. A waiter killed mid-wait leaves a ticket that
// otherWaiters drops once its pid is gone.
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    signalled = true;
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      child.kill(signal);
    }
  });
}

// Async, so the beat and the signal listeners run during the landing. spawn throws where spawnSync
// returned an error, for a Windows .cmd run without a shell.
const runLand = (file, argv, options) =>
  new Promise((resolve) => {
    try {
      // JND_LAND_HELD tells the landing's checks they hold the lock, so a repo's check can use
      // state shared between landings (a shared build cache) only then.
      // The waiters dir, this lock's token and a report file let land-forgejo batch waiting landings
      // (D294) and hand back its check runs, a note for the log and the worktrees to put back.
      child = spawn(file, argv, {
        stdio: "inherit",
        env: { ...process.env, JND_LAND_HELD: String(pr), JND_LAND_WAITERS_DIR: waitersDir, JND_LAND_TOKEN: token, JND_LAND_REPORT: reportFile },
        ...options,
      });
    } catch (error) {
      resolve({ error, status: null });
      return;
    }
    child.on("error", (error) => resolve({ error, status: null }));
    child.on("close", (status) => resolve({ status }));
  });

const reportFile = path.join(commonDir, `jnd-land-report-${token}.json`);
// What the Land command reported. A landing stopped mid-batch leaves worktrees holding merges of
// other PRs: each goes back to the head it names before the lock is freed, so no branch lands
// another PR's unchecked commits later.
const readReport = () => {
  let report = {};
  try {
    report = JSON.parse(fs.readFileSync(reportFile, "utf8"));
  } catch {}
  fs.rmSync(reportFile, { force: true });
  for (const [cwd, sha] of Object.entries(report.restore ?? {})) {
    if (!/^[0-9a-f]{40,64}$/.test(sha)) continue;
    spawnSync("git", ["merge", "--abort"], { cwd, stdio: "ignore" });
    console.error(`land-lock: putting ${cwd} back at ${sha.slice(0, 7)}`);
    spawnSync("git", ["reset", "--hard", sha], { cwd, stdio: "inherit" });
  }
  return report;
};

const waitS = Math.round((Date.now() - start) / 1000);
const runStart = Date.now();
let code = 1;
try {
  // No shell, so arguments pass through untouched. Windows .cmd shims need one, so fall back to it there.
  let result = await runLand(command[0], command.slice(1), {});
  if (result.error && process.platform === "win32") {
    result = await runLand(command.join(" "), [], { shell: true });
  }
  if (result.error) console.error(`land-lock: ${result.error.message}`);
  // A landing that finished before the signal took it did land, so its 0 stands.
  code = signalled && result.status !== 0 ? 130 : (result.status ?? 1);
} finally {
  clearInterval(beat);
  const report = readReport();
  release();
  log(waitS, Math.round((Date.now() - runStart) / 1000), code, report.runs ?? "", report.note ?? "");
}
process.exit(code);
