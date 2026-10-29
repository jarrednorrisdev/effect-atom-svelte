#!/usr/bin/env node
// Runs a repo's Land command so only one landing runs at a time per repo on this machine,
// and logs each landing's wait and run time.
//
//   node land-lock.mjs --pr <n> [--max-wait <seconds>] -- <land command...>
//   node land-lock.mjs --stats [--days <n>]
//
// The lock and the log live in the repo's git common dir, so every worktree shares them.
// Exit codes: the Land command's own, 75 when the lock stayed busy past --max-wait (default 300 s),
// 2 for bad arguments.

import { execFileSync, spawnSync } from "node:child_process";
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

const commonDir = path.resolve(execFileSync("git", ["rev-parse", "--git-common-dir"], { encoding: "utf8" }).trim());
const lockDir = path.join(commonDir, "jnd-land.lock");
const logFile = path.join(commonDir, "jnd-land-log.tsv");
const STALE_MS = 30 * 60 * 1000;

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
  console.log(`last ${days} days: ${landed.size} PRs landed, ${ran.length} runs, ${recent.length - ran.length} busy timeouts`);
  console.log(`median wait ${median(ran.map((r) => Number(r[2])))} s, median run ${median(ran.map((r) => Number(r[3])))} s`);
  console.log(`failed runs ${ran.filter((r) => r[4] !== "0").length}, PRs that needed more than one run ${retried}`);
  process.exit(0);
}

const pr = flag("--pr");
const maxWait = Number(flag("--max-wait", 300)) * 1000;
if (!pr || command.length === 0 || Number.isNaN(maxWait)) {
  console.error("usage: node land-lock.mjs --pr <n> [--max-wait <seconds>] -- <land command...>");
  process.exit(2);
}

const log = (waitS, runS, result) => {
  if (!fs.existsSync(logFile)) fs.writeFileSync(logFile, "at\tpr\twait_s\trun_s\texit\thost\n");
  fs.appendFileSync(logFile, `${new Date().toISOString()}\t${pr}\t${waitS}\t${runS}\t${result}\t${os.hostname()}\n`);
};

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
};

const tryLock = () => {
  try {
    fs.mkdirSync(lockDir);
    fs.writeFileSync(path.join(lockDir, "owner.json"), JSON.stringify({ pid: process.pid, pr, started: Date.now() }));
    return true;
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
    let owner = null;
    try {
      owner = JSON.parse(fs.readFileSync(path.join(lockDir, "owner.json"), "utf8"));
    } catch {}
    const stale = owner ? !alive(owner.pid) || Date.now() - owner.started > STALE_MS : false;
    if (stale) {
      console.error(`land-lock: clearing a stale lock from PR ${owner.pr} (pid ${owner.pid})`);
      fs.rmSync(lockDir, { recursive: true, force: true });
      return tryLock();
    }
    return owner;
  }
};

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const start = Date.now();
let announced = false;
for (;;) {
  const got = tryLock();
  if (got === true) break;
  if (!announced && got) console.error(`land-lock: waiting for PR ${got.pr}'s landing to finish`);
  announced = true;
  if (Date.now() - start > maxWait) {
    log(Math.round((Date.now() - start) / 1000), 0, "busy");
    console.error("land-lock: still busy; run the same command again");
    process.exit(75);
  }
  sleep(Math.min(5000, Math.max(100, maxWait - (Date.now() - start))));
}

const release = () => fs.rmSync(lockDir, { recursive: true, force: true });
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    release();
    process.exit(130);
  });
}

const waitS = Math.round((Date.now() - start) / 1000);
const runStart = Date.now();
let code = 1;
try {
  // No shell, so arguments pass through untouched. Windows .cmd shims need one, so fall back to it there.
  let result = spawnSync(command[0], command.slice(1), { stdio: "inherit" });
  if (result.error && process.platform === "win32") {
    result = spawnSync(command.join(" "), { stdio: "inherit", shell: true });
  }
  if (result.error) console.error(`land-lock: ${result.error.message}`);
  code = result.status ?? 1;
} finally {
  release();
  log(waitS, Math.round((Date.now() - runStart) / 1000), code);
}
process.exit(code);
