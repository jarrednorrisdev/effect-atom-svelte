import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import svelte from "ultracite/oxlint/svelte";

export default defineConfig({
  extends: [core, svelte],
  // shadcn-svelte's generated components: kept as the CLI writes them, so `shadcn-svelte add` can
  // update them.
  ignorePatterns: [
    "apps/demo/src/lib/components/ui/**",
    "apps/demo/src/lib/hooks/is-mobile.svelte.ts",
  ],
  overrides: [
    {
      // The library mirrors Effect's adapter packages (@effect/atom-react and friends) so it can be
      // upstreamed: PascalCase module files, and an index that re-exports the public API.
      files: ["packages/effect-atom-svelte/src/**"],
      rules: {
        // Effect documents every export with @stability and @category alongside @since.
        "jsdoc/check-tag-names": [
          "error",
          { definedTags: ["category", "stability"] },
        ],
        "oxc/no-barrel-file": "off",
        "unicorn/filename-case": "off",
      },
    },
    {
      // Effect schemas, errors, services and API groups are classes; a domain module holds several.
      // Schema.TaggedError is a class factory, which unicorn mistakes for a throw without `new`.
      files: [
        "apps/demo/src/lib/**",
        "packages/demo-domain/src/**",
        "packages/effect-atom-svelte/test/**",
      ],
      rules: {
        "eslint/max-classes-per-file": "off",
        "unicorn/throw-new-error": "off",
      },
    },
    {
      // End-to-end steps run one after another on purpose: each depends on the page the last left.
      files: ["apps/demo/e2e/**"],
      rules: {
        "eslint/no-await-in-loop": "off",
      },
    },
  ],
  rules: {
    // Effect APIs take an explicit `undefined` for void payloads (AtomRpc.query, Atom.Writable<_, void>);
    // the autofix deletes it and breaks the call.
    "unicorn/no-useless-undefined": "off",
  },
});
