import { svelte } from "@sveltejs/vite-plugin-svelte";
import { createServer } from "vite";
import type { ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { atomLabels } from "../src/vite.ts";

// The plugin in a real dev server, with the Svelte plugin after it, loading the fixtures as the
// server-side half of an app would.
let server: ViteDevServer;
beforeAll(async () => {
  server = await createServer({
    configFile: false,
    logLevel: "silent",
    plugins: [atomLabels(), svelte()],
    root: import.meta.dirname,
    server: { middlewareMode: true, ws: false },
  });
});
afterAll(async () => {
  await server.close();
});

describe("atomLabels", () => {
  test("labels a module's atoms, keeping what isn't an atom as it was", async () => {
    const atoms = await server.ssrLoadModule("/fixtures/atoms.ts");
    expect(atoms.countAtom.label).toEqual([
      "countAtom",
      "at countAtom (/fixtures/atoms.ts:3:14)",
    ]);
    expect(atoms.doubleAtom.label[0]).toBe("doubleAtom");
    expect(atoms.doubleAtom.keepAlive).toBe(true);
    expect(atoms.todoAtom(2).label[0]).toBe("todoAtom(2)");
    expect(atoms.notAnAtom).toBe("1");
  });

  test("labels the atoms of a component's module script", async () => {
    const counter = await server.ssrLoadModule("/fixtures/counter.svelte");
    expect(counter.sharedAtom.label).toEqual([
      "sharedAtom",
      "at sharedAtom (/fixtures/counter.svelte:4:16)",
    ]);
  });

  test("isn't applied by a build", () => {
    const plugin = atomLabels();
    const apply = plugin.apply as (
      config: object,
      env: { command: string; mode: string }
    ) => boolean;
    expect(apply({}, { command: "build", mode: "production" })).toBe(false);
    expect(apply({}, { command: "serve", mode: "development" })).toBe(true);
  });
});
