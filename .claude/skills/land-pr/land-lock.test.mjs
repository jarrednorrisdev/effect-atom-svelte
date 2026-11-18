// node --test land-lock.test.mjs
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "land-lock.mjs");

const setup = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "land-lock-"));
  const lock = path.join(dir, "jnd-land.lock");
  // The Land command: records when it starts and ends, holding the lock for a moment between.
  const holder = path.join(dir, "holder.mjs");
  fs.writeFileSync(
    holder,
    `import fs from "node:fs";
const [id, file] = process.argv.slice(2);
fs.appendFileSync(file, "start " + id + "\\n");
Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200);
fs.appendFileSync(file, "end " + id + "\\n");
`,
  );
  const events = path.join(dir, "events.txt");
  const args = (id, maxWait) => [script, "--pr", id, "--max-wait", String(maxWait), "--", process.execPath, holder, id, events];
  const env = { ...process.env, JND_LAND_DIR: dir };
  const read = () => (fs.existsSync(events) ? fs.readFileSync(events, "utf8").trim().split("\n") : []);
  return { dir, lock, args, env, read };
};

const run = (args, env) => spawnSync(process.execPath, args, { env, encoding: "utf8" });

const runAsync = (args, env) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, args, { env });
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (status) => resolve({ status, stderr }));
  });

const age = (dir, ms) => {
  const t = new Date(Date.now() - ms);
  fs.utimesSync(dir, t, t);
};

test("an ownerless lock older than the grace is taken", () => {
  const { lock, args, env, read } = setup();
  fs.mkdirSync(lock);
  age(lock, 60_000);
  const r = run(args("1", 2), env);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(read(), ["start 1", "end 1"]);
  assert.equal(fs.existsSync(lock), false);
});

test("an ownerless lock inside the grace is waited on", () => {
  const { lock, args, env, read } = setup();
  fs.mkdirSync(lock);
  const r = run(args("1", 1), env);
  assert.equal(r.status, 75, r.stderr);
  assert.deepEqual(read(), []);
  assert.equal(fs.existsSync(lock), true);
});

test("a waiter that judged a lock stale leaves the live lock that replaced it", async () => {
  const { lock, args, env, read } = setup();
  const deadPid = spawnSync(process.execPath, ["-e", ""]).pid;
  fs.mkdirSync(lock);
  fs.writeFileSync(path.join(lock, "owner.json"), JSON.stringify({ pid: deadPid, pr: "0", started: Date.now() }));
  const waiter = runAsync(args("1", 4), { ...env, JND_LAND_TAKEOVER_PAUSE_MS: "3000" });
  await new Promise((resolve) => setTimeout(resolve, 1000));
  fs.rmSync(lock, { recursive: true });
  fs.mkdirSync(lock);
  const live = JSON.stringify({ pid: process.pid, pr: "2", started: Date.now() });
  fs.writeFileSync(path.join(lock, "owner.json"), live);
  const r = await waiter;
  assert.match(r.stderr, /clearing a stale lock from PR 0/);
  assert.equal(r.status, 75, r.stderr);
  assert.deepEqual(read(), []);
  assert.equal(fs.readFileSync(path.join(lock, "owner.json"), "utf8"), live);
  assert.deepEqual(fs.readdirSync(lock), ["owner.json"]);
});

test("a stale lock whose takeover was abandoned is taken on the next try", () => {
  const { lock, args, env, read } = setup();
  fs.mkdirSync(path.join(lock, "takeover"), { recursive: true });
  age(path.join(lock, "takeover"), 60_000);
  age(lock, 60_000);
  const r = run(args("1", 20), env);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(read(), ["start 1", "end 1"]);
});

test("a landing clears a lock folder a killed takeover left aside", () => {
  const { dir, args, env } = setup();
  const old = path.join(dir, "jnd-land.lock.stale-1-x");
  const fresh = path.join(dir, "jnd-land.lock.stale-2-y");
  fs.mkdirSync(old);
  fs.mkdirSync(fresh);
  age(old, 60_000);
  const r = run(args("1", 2), env);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.existsSync(old), false);
  assert.equal(fs.existsSync(fresh), true);
});

test("waiters racing to take one stale lock run one at a time", async () => {
  const { lock, args, env, read } = setup();
  const deadPid = spawnSync(process.execPath, ["-e", ""]).pid;
  fs.mkdirSync(lock);
  fs.writeFileSync(path.join(lock, "owner.json"), JSON.stringify({ pid: deadPid, pr: "0", started: Date.now() }));
  const ids = ["1", "2", "3", "4"];
  // Every waiter judges the lock stale before any of them takes it.
  const paused = { ...env, JND_LAND_TAKEOVER_PAUSE_MS: "1500" };
  const results = await Promise.all(ids.map((id) => runAsync(args(id, 60), paused)));
  for (const r of results) assert.equal(r.status, 0, r.stderr);
  const events = read();
  assert.equal(events.length, ids.length * 2, events.join("\n"));
  for (let i = 0; i < events.length; i += 2) {
    const id = events[i].split(" ")[1];
    assert.deepEqual([events[i], events[i + 1]], [`start ${id}`, `end ${id}`], events.join("\n"));
  }
});

test("a waiter names each new holder, and the landings waiting beside it", async () => {
  const { dir, lock, args, env, read } = setup();
  const hold = (pr) => {
    fs.rmSync(lock, { recursive: true, force: true });
    fs.mkdirSync(lock);
    fs.writeFileSync(path.join(lock, "owner.json"), JSON.stringify({ pid: process.pid, pr, started: Date.now() }));
  };
  hold("7");
  const waiters = path.join(dir, "jnd-land-waiters");
  fs.mkdirSync(waiters);
  const deadPid = spawnSync(process.execPath, ["-e", ""]).pid;
  fs.writeFileSync(path.join(waiters, `${deadPid}.json`), "{}");
  // A killed waiter's file whose pid a live process (the test runner's parent) took since.
  const reused = path.join(waiters, `${process.ppid}.json`);
  fs.writeFileSync(reused, "{}");
  age(reused, 3 * 60 * 60 * 1000);
  // This test's own process stands for a second landing that waits.
  fs.writeFileSync(path.join(waiters, `${process.pid}.json`), "{}");
  const waiter = runAsync(args("1", 4), env);
  await new Promise((resolve) => setTimeout(resolve, 1500));
  hold("8");
  const r = await waiter;
  assert.equal(r.status, 75, r.stderr);
  assert.deepEqual(read(), []);
  const lines = r.stderr.trim().split("\n");
  assert.match(lines[0], /^land-lock: waiting for PR 7's landing \(pid \d+, holding it 0 min\); 1 other landing waits too$/);
  assert.match(lines[1], /^land-lock: waiting for PR 8's landing \(pid \d+, holding it 0 min\); 1 other landing waits too$/);
  assert.match(lines[2], /^land-lock: still busy after \d+ s \(PR 8's landing holds it\); run the same command again$/);
  assert.equal(lines.length, 3, r.stderr);
  assert.deepEqual(fs.readdirSync(waiters), [`${process.pid}.json`]);
});

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("waiters take a held lock in the order they began waiting", async () => {
  const { dir, lock, args, env, read } = setup();
  fs.mkdirSync(lock);
  fs.writeFileSync(path.join(lock, "owner.json"), JSON.stringify({ pid: process.pid, pr: "0", started: Date.now() }));
  const fast = { ...env, JND_LAND_POLL_MS: "100" };
  const tickets = path.join(dir, "jnd-land-waiters");
  const queued = () => (fs.existsSync(tickets) ? fs.readdirSync(tickets).length : 0);
  const waiters = [];
  // Started last to first by id, so an order by pid or by id would fail. Each starts once the
  // one before has written its ticket, so a slow process start can't reorder them.
  for (const id of ["3", "1", "2"]) {
    const before = queued();
    waiters.push(runAsync(args(id, 60), fast));
    while (queued() === before) await pause(50);
    await pause(20);
  }
  fs.rmSync(lock, { recursive: true });
  const results = await Promise.all(waiters);
  for (const r of results) assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(read(), ["start 3", "end 3", "start 1", "end 1", "start 2", "end 2"]);
});

test("a live waiter that began first holds the others back", () => {
  const { dir, args, env, read } = setup();
  const waiters = path.join(dir, "jnd-land-waiters");
  fs.mkdirSync(waiters);
  // This test's own process stands for a landing that began waiting first.
  fs.writeFileSync(path.join(waiters, `${process.pid}.json`), JSON.stringify({ pid: process.pid, pr: "9", since: 0 }));
  const r = run(args("1", 1), { ...env, JND_LAND_POLL_MS: "100" });
  assert.equal(r.status, 75, r.stderr);
  assert.deepEqual(read(), []);
  assert.match(r.stderr, /^land-lock: waiting for the landing ahead of it in the queue; 1 other landing waits too, 1 ahead of it$/m);
});

test("a dead waiter's ticket ahead in the queue doesn't hold up a live one", () => {
  const { dir, args, env, read } = setup();
  const waiters = path.join(dir, "jnd-land-waiters");
  fs.mkdirSync(waiters);
  const deadPid = spawnSync(process.execPath, ["-e", ""]).pid;
  const dead = path.join(waiters, `${deadPid}.json`);
  fs.writeFileSync(dead, JSON.stringify({ pid: deadPid, pr: "8", since: 0 }));
  // A killed waiter's file whose pid a live process (the test runner's parent) took since.
  const reused = path.join(waiters, `${process.ppid}.json`);
  fs.writeFileSync(reused, JSON.stringify({ pid: process.ppid, pr: "9", since: 0 }));
  age(reused, 2 * 60 * 1000);
  const r = run(args("1", 2), env);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(read(), ["start 1", "end 1"]);
  assert.deepEqual(fs.readdirSync(waiters), []);
});

test("two real waiters count each other, and the one that takes the lock leaves the count", async () => {
  const { dir, lock } = setup();
  fs.mkdirSync(lock);
  fs.writeFileSync(path.join(lock, "owner.json"), JSON.stringify({ pid: process.pid, pr: "7", started: Date.now() }));
  const waiters = path.join(dir, "jnd-land-waiters");
  // The Land command: records its land-lock's pid and the waiter files present while it runs.
  const snapshot = path.join(dir, "snapshot.mjs");
  fs.writeFileSync(
    snapshot,
    `import fs from "node:fs";
fs.writeFileSync(process.argv[2], JSON.stringify({ lockPid: process.ppid, files: fs.readdirSync(process.argv[3]) }));
`,
  );
  const env = { ...process.env, JND_LAND_DIR: dir };
  const waiter = (id) =>
    runAsync([script, "--pr", id, "--max-wait", "30", "--", process.execPath, snapshot, path.join(dir, `seen-${id}.json`), waiters], env);
  const first = waiter("1");
  await new Promise((resolve) => setTimeout(resolve, 1500));
  // A waiter that waits on rewrites its file, so its age stays under the cap however long it waits.
  const [firstFile] = fs.readdirSync(waiters).map((name) => path.join(waiters, name));
  age(firstFile, 10 * 60 * 1000);
  await new Promise((resolve) => setTimeout(resolve, 5500));
  assert.ok(Date.now() - fs.statSync(firstFile).mtimeMs < 10_000);
  const second = waiter("2");
  await new Promise((resolve) => setTimeout(resolve, 1500));
  fs.rmSync(lock, { recursive: true });
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a.status, 0, a.stderr);
  assert.equal(b.status, 0, b.stderr);
  assert.match(b.stderr.split("\n")[0], /waiting for PR 7's landing .*; 1 other landing waits too, 1 ahead of it$/);
  const seen = ["1", "2"].map((id) => JSON.parse(fs.readFileSync(path.join(dir, `seen-${id}.json`), "utf8")));
  for (const { lockPid, files } of seen) assert.equal(files.includes(`${lockPid}.json`), false, files.join(", "));
  // The first to wait ran while the second still waited, and the second ran alone.
  assert.deepEqual(seen.map(({ files }) => files.length), [1, 0]);
});

const STALE_THRESHOLD_MS = 5 * 60 * 1000;
const ownerAt = (lock) => path.join(lock, "owner.json");
const hold = (lock, owner) => {
  fs.mkdirSync(lock);
  const text = JSON.stringify(owner);
  fs.writeFileSync(ownerAt(lock), text);
  return text;
};

test("a live landing 31 minutes in keeps its lock while it beats", () => {
  const { lock, args, env, read } = setup();
  const text = hold(lock, { pid: process.pid, pr: "9", token: "theirs", started: Date.now() - 31 * 60_000, beat: Date.now() });
  const r = run(args("1", 1), env);
  assert.equal(r.status, 75, r.stderr);
  assert.deepEqual(read(), []);
  assert.equal(fs.readFileSync(ownerAt(lock), "utf8"), text);
});

test("an older land-lock's live owner with no beat is judged by its pid alone", () => {
  const { lock, args, env, read } = setup();
  const text = hold(lock, { pid: process.pid, pr: "9", started: Date.now() - 31 * 60_000 });
  const r = run(args("1", 1), env);
  assert.equal(r.status, 75, r.stderr);
  assert.deepEqual(read(), []);
  assert.equal(fs.readFileSync(ownerAt(lock), "utf8"), text);
});

test("a beat just over the stale threshold gives up the lock, though its pid runs", () => {
  const { lock, args, env, read } = setup();
  hold(lock, { pid: process.pid, pr: "9", token: "theirs", started: Date.now(), beat: Date.now() - STALE_THRESHOLD_MS - 5_000 });
  const r = run(args("1", 2), env);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /clearing a stale lock from PR 9/);
  assert.deepEqual(read(), ["start 1", "end 1"]);
});

test("a beat just under the stale threshold keeps the lock", () => {
  const { lock, args, env, read } = setup();
  const text = hold(lock, { pid: process.pid, pr: "9", token: "theirs", started: Date.now(), beat: Date.now() - STALE_THRESHOLD_MS + 30_000 });
  const r = run(args("1", 1), env);
  assert.equal(r.status, 75, r.stderr);
  assert.deepEqual(read(), []);
  assert.equal(fs.readFileSync(ownerAt(lock), "utf8"), text);
});

test("a landing that lost its lock neither beats on nor frees the next holder's, even with its pid", () => {
  const { dir, lock, env } = setup();
  // The Land command: while it runs, a holder with this landing's own pid (a reused pid) and
  // another token replaces the lock, and stays through several beats.
  const replace = path.join(dir, "replace.mjs");
  fs.writeFileSync(
    replace,
    `import fs from "node:fs";
import path from "node:path";
const lock = process.argv[2];
const text = JSON.stringify({ pid: process.ppid, pr: "9", token: "theirs", started: 1, beat: Date.now() });
fs.rmSync(lock, { recursive: true, force: true });
fs.mkdirSync(lock);
fs.writeFileSync(path.join(lock, "owner.json"), text);
fs.writeFileSync(process.argv[3], text);
Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 400);
`,
  );
  const expected = path.join(dir, "expected.txt");
  const r = run([script, "--pr", "1", "--max-wait", "1", "--", process.execPath, replace, lock, expected], { ...env, JND_LAND_BEAT_MS: "20" });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.existsSync(ownerAt(lock)) ? fs.readFileSync(ownerAt(lock), "utf8") : "gone", fs.readFileSync(expected, "utf8"));
});

test("the holder's beat advances, and a reader never finds its owner file empty or missing", () => {
  const { dir, lock, env } = setup();
  // The Land command: reads the owner file as hard as a poll could for two seconds. A read a
  // rename blocks on Windows is an open error, which says nothing about the file's contents.
  const reader = path.join(dir, "reader.mjs");
  fs.writeFileSync(
    reader,
    `import fs from "node:fs";
const [file, out] = process.argv.slice(2);
const seen = { reads: 0, torn: [], beats: new Set(), tokens: new Set(), started: new Set() };
const end = Date.now() + 2000;
while (Date.now() < end) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (e) {
    if (e.code === "ENOENT") seen.torn.push("missing");
    continue;
  }
  seen.reads += 1;
  try {
    const owner = JSON.parse(text);
    seen.beats.add(owner.beat);
    seen.tokens.add(owner.token);
    seen.started.add(owner.started);
  } catch {
    seen.torn.push(text);
  }
}
fs.writeFileSync(out, JSON.stringify({ reads: seen.reads, torn: seen.torn, beats: seen.beats.size, tokens: seen.tokens.size, started: seen.started.size }));
`,
  );
  const out = path.join(dir, "seen.json");
  const r = run([script, "--pr", "1", "--max-wait", "1", "--", process.execPath, reader, ownerAt(lock), out], { ...env, JND_LAND_BEAT_MS: "10" });
  assert.equal(r.status, 0, r.stderr);
  const seen = JSON.parse(fs.readFileSync(out, "utf8"));
  assert.ok(seen.reads > 100, `only ${seen.reads} reads`);
  assert.deepEqual(seen.torn, []);
  assert.ok(seen.beats >= 3, `only ${seen.beats} beats seen`);
  assert.equal(seen.tokens, 1);
  assert.equal(seen.started, 1);
});

const running = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
};
const gone = async (pid) => {
  for (let i = 0; i < 40 && running(pid); i += 1) await pause(50);
  return !running(pid);
};

// Runs a landing and stops it with `signal` once its Land command is up. Process.kill can't reach a
// handler on Windows, so a preload raises the signal inside land-lock. `killDelayMs` makes the
// Land command take that long to die, recording whether the lock is still there when it does.
const signalled = async (signal, killDelayMs = 0, landMs = 20_000) => {
  const { dir, lock, env } = setup();
  const up = path.join(dir, "up.txt");
  const trace = path.join(dir, "trace.txt");
  const preload = path.join(dir, "preload.mjs");
  fs.writeFileSync(
    preload,
    `import cp, { ChildProcess } from "node:child_process";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
const delay = ${killDelayMs};
const later = (kill) => {
  fs.appendFileSync(${JSON.stringify(trace)}, "forwarded\\n");
  setTimeout(() => {
    fs.appendFileSync(${JSON.stringify(trace)}, "lock held at the kill: " + fs.existsSync(${JSON.stringify(lock)}) + "\\n");
    kill();
  }, delay);
};
const realSpawnSync = cp.spawnSync;
cp.spawnSync = (file, ...rest) => {
  if (file !== "taskkill") return realSpawnSync(file, ...rest);
  later(() => realSpawnSync(file, ...rest));
  return { status: 0 };
};
syncBuiltinESMExports();
const realKill = ChildProcess.prototype.kill;
ChildProcess.prototype.kill = function (sig) {
  later(() => realKill.call(this, sig));
  return true;
};
const timer = setInterval(() => {
  if (!fs.existsSync(${JSON.stringify(up)})) return;
  clearInterval(timer);
  process.emit(${JSON.stringify(signal)}, ${JSON.stringify(signal)});
}, 20);
timer.unref();
`,
  );
  // The Land command: a process with a child of its own, both of which would run on for 20 s. The
  // child is detached because libuv's job object would otherwise end it with its parent on Windows,
  // however the parent died, and a real landing's descendants don't all die that way.
  const land = path.join(dir, "land.mjs");
  fs.writeFileSync(
    land,
    `import { spawn } from "node:child_process";
import fs from "node:fs";
const grandchild = spawn(process.execPath, ["-e", "setTimeout(() => {}, ${landMs})"], { stdio: "ignore", detached: true });
fs.writeFileSync(process.argv[2] + ".tmp", JSON.stringify({ child: process.pid, grandchild: grandchild.pid }));
fs.renameSync(process.argv[2] + ".tmp", process.argv[2]);
setTimeout(() => process.exit(0), ${landMs});
`,
  );
  const r = await runAsync(["--import", pathToFileURL(preload).href, script, "--pr", "1", "--max-wait", "1", "--", process.execPath, land, up], env);
  const pids = JSON.parse(fs.readFileSync(up, "utf8"));
  const row = fs.readFileSync(path.join(dir, "jnd-land-log.tsv"), "utf8").trim().split("\n")[1];
  return { ...r, lock, pids, trace: fs.readFileSync(trace, "utf8").trim().split("\n"), logged: row.split("\t")[4] };
};

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  test(`${signal} ends the Land command, then frees the lock and logs the run`, async () => {
    const r = await signalled(signal);
    assert.equal(r.status, 130, r.stderr);
    assert.equal(r.logged, "130");
    assert.equal(fs.existsSync(r.lock), false);
    assert.equal(await gone(r.pids.child), true, "the Land command runs on");
    // A POSIX signal goes to the child alone, which then ends its own children.
    if (process.platform === "win32") assert.equal(await gone(r.pids.grandchild), true, "the Land command's child runs on");
  });
}

test("a signal leaves the lock held until the Land command is gone", async () => {
  const r = await signalled("SIGTERM", 500);
  assert.deepEqual(r.trace, ["forwarded", "lock held at the kill: true"]);
  assert.equal(r.status, 130, r.stderr);
  assert.equal(fs.existsSync(r.lock), false);
});

test("a Land command that finishes 0 after a signal keeps its 0, since it did land", async () => {
  // The kill comes well after the Land command's own exit, so the signal reaches a landing that
  // then finishes by itself.
  const r = await signalled("SIGTERM", 5_000, 800);
  assert.deepEqual(r.trace, ["forwarded"]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.logged, "0");
  assert.equal(fs.existsSync(r.lock), false);
});

test("a .cmd Land command runs through the shell", { skip: process.platform !== "win32" }, () => {
  const { dir, env } = setup();
  const shim = path.join(dir, "land.cmd");
  const ran = path.join(dir, "ran.txt");
  fs.writeFileSync(shim, `@echo ran> "${ran}"\r\n`);
  const r = run([script, "--pr", "1", "--max-wait", "1", "--", shim], env);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.existsSync(ran), true);
});
