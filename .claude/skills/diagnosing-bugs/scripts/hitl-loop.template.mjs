#!/usr/bin/env node
// Human-in-the-loop reproduction loop.
// Copy this file, edit the steps below, and run it: `node <copy>`.
// The agent runs the script; the user follows prompts in their terminal.
//
// Two helpers:
//   await step("<instruction>")          → show instruction, wait for Enter
//   await capture("VAR", "<question>")   → show question, record the answer as VAR
//
// At the end, captured values are printed as KEY=VALUE for the agent to parse.
//
// `capture` prints its value back to the terminal, where the agent reads it,
// so capture observations, and leave signing in to the user as a `step`.

import readline from "node:readline";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const queued = [];
let answer = null;
rl.on("line", (line) => (answer ? answer(line) : queued.push(line)));
rl.on("close", () => {
  if (answer) process.exit(1); // stdin ended mid-question
});
const ask = (prompt) =>
  new Promise((resolve) => {
    process.stdout.write(prompt);
    const done = (line) => {
      answer = null;
      resolve(line.trim());
    };
    if (queued.length) done(queued.shift());
    else answer = done;
  });

const captured = {};
const step = async (instruction) => {
  console.log(`\n>>> ${instruction}`);
  await ask("    [Enter when done] ");
};
const capture = async (name, question) => {
  console.log(`\n>>> ${question}`);
  captured[name] = await ask("    > ");
};

// --- edit below ---------------------------------------------------------

await step("Open the app at http://localhost:3000 and sign in.");

await capture("ERRORED", "Click the 'Export' button. Did it throw an error? (y/n)");

await capture("ERROR_MSG", "Paste the error message (or 'none'):");

// --- edit above ---------------------------------------------------------

console.log("\n--- Captured ---");
for (const [name, value] of Object.entries(captured)) console.log(`${name}=${value}`);
rl.close();
