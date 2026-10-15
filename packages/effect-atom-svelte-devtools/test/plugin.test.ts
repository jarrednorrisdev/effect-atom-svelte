import os from "node:os";
import path from "node:path";

import { svelte } from "@sveltejs/vite-plugin-svelte";
import { Atom } from "effect/reactivity";
import { createLogger, createServer } from "vite";
import type { ViteDevServer } from "vite";
import { afterAll, assert, beforeAll, describe, expect, test } from "vitest";

import { atomLabels } from "../src/vite.ts";
import type {
  countAtom,
  doubleAtom,
  fromFamily,
  fromMap,
  notAnAtom,
  todoAtom,
} from "./fixtures/atoms.ts";

/** What ./fixtures/atoms.ts exports. */
interface Fixtures {
  readonly countAtom: typeof countAtom;
  readonly doubleAtom: typeof doubleAtom;
  readonly fromFamily: typeof fromFamily;
  readonly fromMap: typeof fromMap;
  readonly notAnAtom: typeof notAnAtom;
  readonly todoAtom: typeof todoAtom;
}

const fixtureNames = [
  "countAtom",
  "doubleAtom",
  "fromFamily",
  "fromMap",
  "notAnAtom",
  "todoAtom",
] as const;

// The dev server loads the fixture module untyped: it is the fixtures if it has their exports.
const isFixtures = (module: unknown): module is Fixtures =>
  typeof module === "object" &&
  module !== null &&
  fixtureNames.every((name) => name in module);

/** The label of what a loaded module exports, if it is an atom. */
const labelOf = (value: unknown) =>
  Atom.isAtom(value) ? value.label : undefined;

describe(atomLabels, () => {
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

  test("labels a module's atoms, keeping what isn't an atom as it was", async () => {
    const atoms: unknown = await server.ssrLoadModule("/fixtures/atoms.ts");
    assert(isFixtures(atoms));
    expect(atoms.countAtom.label).toStrictEqual([
      "countAtom",
      "at countAtom (/fixtures/atoms.ts:3:14)",
    ]);
    expect(atoms.doubleAtom.label?.[0]).toBe("doubleAtom");
    expect(atoms.doubleAtom.keepAlive).toBe(true);
    expect(atoms.todoAtom(2).label?.[0]).toBe("todoAtom(2)");
    expect(atoms.notAnAtom).toBe("1");
  });

  test("names what an atom factory's calls return after the call", async () => {
    const atoms: unknown = await server.ssrLoadModule("/fixtures/atoms.ts");
    assert(isFixtures(atoms));
    const [one, two] = atoms.fromMap;
    expect(one).not.toBe(two);
    expect(one?.label?.[0]).toBe('mapDraftAtom("a")');
    expect(two?.label?.[0]).toBe('mapDraftAtom("a")');
    expect(atoms.fromFamily.label?.[0]).toBe('draftAtom("a")');
  });

  test("labels the atoms of a component's module script", async () => {
    const counter = await server.ssrLoadModule("/fixtures/counter.svelte");
    expect(labelOf(counter.sharedAtom)).toStrictEqual([
      "sharedAtom",
      "at sharedAtom (/fixtures/counter.svelte:4:16)",
    ]);
  });

  test("isn't applied by a build", () => {
    const { apply } = atomLabels();
    assert(typeof apply === "function");
    expect(apply({}, { command: "build", mode: "production" })).toBe(false);
    expect(apply({}, { command: "serve", mode: "development" })).toBe(true);
  });
});

describe("atomLabels after the Svelte plugin", () => {
  // vite-plugin-svelte 7 compiles in a plugin without `enforce: "pre"`, so atomLabels, which has
  // it, still sees components first: the warning that they aren't labelled is wrong.
  test("doesn't warn that components aren't labelled when they are", async () => {
    const warnings: string[] = [];
    const logger = createLogger("silent");
    logger.warn = (message) => {
      warnings.push(message);
    };
    const ordered = await createServer({
      // Its own, so it doesn't re-bundle plugin.test.ts's dependencies as that runs.
      cacheDir: path.join(os.tmpdir(), "effect-atom-svelte-devtools-hunt3"),
      configFile: false,
      customLogger: logger,
      plugins: [svelte(), atomLabels()],
      root: import.meta.dirname,
      server: { middlewareMode: true, ws: false },
    });
    try {
      const counter = await ordered.ssrLoadModule("/fixtures/counter.svelte");
      expect(labelOf(counter.sharedAtom)?.[0]).toBe("sharedAtom");
      expect(
        warnings.filter((warning) => warning.includes("atomLabels()"))
      ).toStrictEqual([]);
    } finally {
      await ordered.close();
    }
  });
});
