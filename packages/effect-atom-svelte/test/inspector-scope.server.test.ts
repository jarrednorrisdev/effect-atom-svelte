import { render } from "svelte/server";
import { expect, test } from "vitest";

import type { InspectorScope } from "../src/Inspector.ts";
import ScopeHost from "./fixtures/scope-host.svelte";

test("a scope renders on the server, empty and without errors", async () => {
  let scope: InspectorScope | undefined;
  const { body } = await render(ScopeHost, {
    props: {
      onscope: (provided: InspectorScope) => {
        scope = provided;
      },
    },
  });
  expect(body).toContain("<output>3</output>");
  expect(scope?.snapshot()).toEqual({ edges: [], nodes: [], readers: [] });
  expect(() => scope?.subscribe(() => undefined)()).not.toThrow();
});
