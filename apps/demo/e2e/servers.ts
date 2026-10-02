import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { test as base } from "@playwright/test";

const demoDir = fileURLToPath(new URL("..", import.meta.url));
const apiDir = fileURLToPath(new URL("../../demo-api", import.meta.url));
const viteBin = fileURLToPath(
  new URL("../node_modules/vite/bin/vite.js", import.meta.url)
);

/** One worker's demo API and preview server. */
export interface Servers {
  /** Origin of the demo API, e.g. `http://localhost:3100`. */
  readonly api: string;
  /** Origin of the production build's preview server, e.g. `http://localhost:5200`. */
  readonly web: string;
}

/** Starts a server process and resolves once `url` answers, or rejects with its output if it exits. */
const start = async (
  command: string,
  args: readonly string[],
  options: { readonly cwd: string; readonly env: NodeJS.ProcessEnv },
  url: string
): Promise<ChildProcess> => {
  // Spawned directly, not through a shell or package script, so kill() stops the server itself.
  // On Windows a wrapper's child outlives it and holds the port.
  const child = spawn(command, args, { ...options, stdio: "pipe" });
  let output = "";
  child.stdout.on("data", (chunk: Buffer) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk: Buffer) => {
    output += chunk.toString();
  });
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`${command} ${args.join(" ")} exited:\n${output}`);
    }
    try {
      await fetch(url);
      return child;
    } catch {
      await delay(50);
    }
  }
  child.kill();
  throw new Error(`${url} did not answer within 30 s:\n${output}`);
};

/**
 * Each worker runs its own demo API and preview server, so parallel tests never share the API's
 * in-memory store, and the store is reset before every test, so no test depends on another.
 */
export const test = base.extend<
  { resetStore: undefined },
  { servers: Servers }
>({
  baseURL: async ({ servers }, use) => {
    await use(servers.web);
  },
  resetStore: [
    async ({ servers }, use) => {
      const response = await fetch(`${servers.api}/__reset`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`resetting the demo store failed: ${response.status}`);
      }
      await use(undefined);
    },
    { auto: true },
  ],
  servers: [
    // oxlint-disable-next-line no-empty-pattern -- Playwright requires a destructuring pattern here.
    async ({}, use, workerInfo) => {
      // Away from the dev servers (3010, 5180) and the default preview port (5181).
      const api = `http://localhost:${3100 + workerInfo.parallelIndex}`;
      const web = `http://localhost:${5200 + workerInfo.parallelIndex}`;
      const apiProcess = await start(
        "bun",
        ["src/main.ts"],
        {
          cwd: apiDir,
          env: {
            ...process.env,
            DEMO_LATENCY_MS: "0",
            PORT: new URL(api).port,
          },
        },
        `${api}/api/todos`
      );
      const webProcess = await start(
        process.execPath,
        [viteBin, "preview", "--port", new URL(web).port, "--strictPort"],
        { cwd: demoDir, env: { ...process.env, DEMO_API_ORIGIN: api } },
        web
      ).catch((error: unknown) => {
        apiProcess.kill();
        throw error;
      });
      await use({ api, web });
      webProcess.kill();
      apiProcess.kill();
    },
    { scope: "worker" },
  ],
});

export { expect } from "@playwright/test";
