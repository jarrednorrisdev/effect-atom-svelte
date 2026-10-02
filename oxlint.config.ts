import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import svelte from "ultracite/oxlint/svelte";

export default defineConfig({
  extends: [core, svelte],
  overrides: [
    {
      // The library mirrors Effect's adapter packages (@effect/atom-react and friends) so it can be
      // upstreamed: PascalCase module files, and an index that re-exports the public API.
      files: ["packages/effect-atom-svelte/src/**"],
      rules: {
        "oxc/no-barrel-file": "off",
        "unicorn/filename-case": "off",
      },
    },
    {
      // Effect schemas, errors, services and API groups are classes; a domain module holds several.
      // Schema.TaggedError is a class factory, which unicorn mistakes for a throw without `new`.
      files: [
        "packages/demo-domain/src/**",
        "packages/effect-atom-svelte/test/**",
      ],
      rules: {
        "eslint/max-classes-per-file": "off",
        "unicorn/throw-new-error": "off",
      },
    },
  ],
});
