import { recommended as effect } from "@effect/tsgo/oxlint-presets";
import { defineConfig } from "oxlint";

import antiSlop from "./lint/anti-slop/index.ts";
import core from "./lint/core.ts";
import { ignorePatterns } from "./lint/ignores.ts";
import jsPlugins from "./lint/js-plugins.ts";
import vitestPreset from "./lint/vitest.ts";

/**
 * Vitest's rules, for Vitest's tests only: the demo's e2e and hosted suites
 * are Playwright, whose `test` and `expect` the vitest autofixes would swap
 * for Vitest's.
 */
const vitest = {
  ...vitestPreset,
  overrides: (vitestPreset.overrides ?? []).map((override) => ({
    ...override,
    files: ["packages/**/*.test.ts", "apps/demo/src/**/*.test.ts"],
  })),
};

/**
 * Everywhere: core, vitest, anti-slop, and the github + sonarjs JS plugins,
 * all kept in lint/, then the Effect language service's rules. Oxlint reads
 * only the script blocks of .svelte files.
 */
export default defineConfig({
  extends: [core, vitest, antiSlop, jsPlugins, effect],
  ignorePatterns,
  options: { typeAware: true },
  overrides: [
    {
      // Tests drive Effect from Vitest's and Playwright's async callbacks,
      // and read their setup from the environment.
      files: [
        "**/*.test.ts",
        "**/test/**",
        "apps/demo/e2e/**",
        "apps/demo/e2e-hosted/**",
        "**/vitest.config.ts",
        "**/playwright*.config.ts",
      ],
      rules: {
        // Fixtures stand in for values a test controls, so asserting their
        // types is the point, not a gap in parsing.
        "anti-slop/no-chained-type-assertions": "off",
        "anti-slop/require-safety-comment-for-type-assertion": "off",
        "effecttsgo/any-unknown-in-error-context": "off",
        "effecttsgo/async-function": "off",
        "effecttsgo/crypto-random-uuid": "off",
        "effecttsgo/effect-fn-opportunity": "off",
        "effecttsgo/global-date": "off",
        "effecttsgo/global-fetch": "off",
        "effecttsgo/new-promise": "off",
        "effecttsgo/node-builtin-import": "off",
        "effecttsgo/process-env": "off",
        "effecttsgo/strict-effect-provide": "off",
        "typescript/no-unsafe-type-assertion": "off",
      },
    },
    {
      // The library and its devtools take any value a user's atom holds:
      // `unknown` is their contract, and a `typeof` check is how they read
      // it. There is no I/O boundary to parse at.
      files: [
        "packages/effect-atom-svelte*/**",
        "apps/demo/src/lib/docs/kit/**",
      ],
      rules: {
        "anti-slop/no-known-value-widening": "off",
        "anti-slop/no-runtime-typeof": "off",
        "anti-slop/no-unknown-parameters": "off",
        "anti-slop/no-unknown-returns": "off",
      },
    },
    {
      // Svelte consumes these as promises: promise-mode setters,
      // useAtomResult's top-level await, suspense and hydration seeds.
      files: ["packages/effect-atom-svelte/src/Hooks.svelte.ts"],
      rules: { "effecttsgo/async-function": "off" },
    },
    {
      // Development warnings, and SvelteKit's handleError hooks, which log as
      // SvelteKit's own default does.
      files: ["packages/effect-atom-svelte/src/**"],
      rules: { "effecttsgo/global-console": "off" },
    },
    {
      // The docs site's own machinery (search, sound, motion, the in-tab
      // API's fetch and EventSource) and SvelteKit's load functions and remote
      // functions, which SvelteKit calls as promises.
      files: [
        "apps/demo/src/lib/**",
        "apps/demo/src/routes/**/+*.ts",
        "apps/demo/src/routes/**/*.remote.ts",
      ],
      rules: { "effecttsgo/async-function": "off" },
    },
    {
      // Browser-only animation, sound and UI around the examples.
      files: ["apps/demo/src/lib/docs/**"],
      rules: {
        "effecttsgo/global-random": "off",
        "effecttsgo/global-timers": "off",
        "sonarjs/pseudo-random": "off",
      },
    },
    {
      // The docs teach Data.TaggedError for local errors and Schema's for
      // errors sent over the network, and examples key services "app/...".
      files: ["apps/demo/**"],
      rules: {
        "effecttsgo/deterministic-keys": "off",
        "effecttsgo/prefer-schema-tagged-error": "off",
      },
    },
    {
      // Examples of the code the library meets outside Effect: a promise API,
      // the library's own promise-mode setter, and plain browser timers.
      files: [
        "apps/demo/src/routes/cookbook/todo-form.svelte.ts",
        "apps/demo/src/routes/effect-basics/lazy.svelte",
        "apps/demo/src/routes/lifetimes/timers.svelte.ts",
        "apps/demo/src/routes/refs/profile-api.ts",
      ],
      rules: {
        "effecttsgo/async-function": "off",
        "effecttsgo/global-timers": "off",
        "sonarjs/pseudo-random": "off",
      },
    },
    {
      // Examples' helpers write Svelte state from a task of their own, as an
      // atom can run while Svelte has an update in flight.
      files: [
        "apps/demo/src/routes/async-atoms/kept-requests.svelte.ts",
        "apps/demo/src/routes/suspense/slow-pairs.ts",
        "apps/demo/src/routes/suspense/weather-api.svelte.ts",
        "apps/demo/src/routes/suspense/weather-log.ts",
      ],
      rules: { "effecttsgo/global-timers-in-effect": "off" },
    },
    {
      // Sample orders, which repeat dates and statuses.
      files: ["apps/demo/src/routes/scoped-atoms/admin-data.ts"],
      rules: { "sonarjs/no-duplicate-string": "off" },
    },
    {
      // The deploy stack's entry point: it guards the Alchemy profile and
      // sets the Vite build's environment before Alchemy runs.
      files: ["apps/demo/alchemy.run.ts"],
      rules: {
        "effecttsgo/process-env": "off",
        "effecttsgo/strict-effect-provide": "off",
      },
    },
    {
      // Oxlint lints a component's two script blocks apart, so a `let` in
      // <script module> reads as an implicit global in the other.
      files: ["**/*.svelte"],
      rules: { "sonarjs/no-implicit-global": "off" },
    },
    {
      // The graph draws each atom as a shape: here it is the domain's word.
      files: ["packages/effect-atom-svelte-devtools/src/graph/**"],
      rules: { "anti-slop/no-shape-in-symbol-names": "off" },
    },
    {
      // Build-time Node tooling: Vite plugins and scripts, outside any Effect
      // program.
      files: [
        "apps/demo/vite/**",
        "apps/demo/vite.config.ts",
        "apps/demo/scripts/**",
        "packages/*/scripts/**",
        "packages/effect-atom-svelte-devtools/src/vite.ts",
        "packages/effect-atom-svelte-devtools/src/internal/transform.ts",
      ],
      rules: {
        "effecttsgo/async-function": "off",
        "effecttsgo/global-console": "off",
        "effecttsgo/node-builtin-import": "off",
        "effecttsgo/process-env": "off",
      },
    },
    {
      // Rule lists read best grouped by plugin, under section comments.
      files: ["lint/**"],
      rules: { "sort-keys": "off" },
    },
    {
      // Plain Node scripts: untyped JavaScript.
      files: ["**/scripts/**/*.mjs"],
      rules: {
        "typescript/no-unsafe-argument": "off",
        "typescript/no-unsafe-assignment": "off",
        "typescript/no-unsafe-call": "off",
        "typescript/no-unsafe-member-access": "off",
        "typescript/no-unsafe-return": "off",
      },
    },
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
      // The devtools document their exports as the library does.
      files: ["packages/effect-atom-svelte-devtools/src/**"],
      rules: {
        "jsdoc/check-tag-names": [
          "error",
          { definedTags: ["category", "stability"] },
        ],
      },
    },
    {
      // Effect schemas, errors, services and API groups are classes; a domain module holds several,
      // and so does a docs example that shows an error union.
      // Schema.TaggedError is a class factory, which unicorn mistakes for a throw without `new`.
      files: [
        "apps/demo/src/lib/**",
        "apps/demo/src/routes/**",
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
    {
      // The docs skills' browser scripts visit pages one at a time, as e2e steps do, and the helpers
      // they pass to page.evaluate run in the page, so they can't move to the module's scope.
      files: [".claude/skills/**/scripts/**"],
      rules: {
        "eslint/no-await-in-loop": "off",
        "unicorn/consistent-function-scoping": "off",
      },
    },
  ],
  rules: {
    // switch-exhaustiveness-check proves a union switch complete from its
    // types; default-case would demand a default that hides a missing case.
    "default-case": "off",
    // Effect rules beyond the recommended preset, or set differently.
    "effecttsgo/abort-controller-in-effect": "warn",
    "effecttsgo/any-unknown-in-error-context": "error",
    "effecttsgo/async-function": "warn",
    "effecttsgo/crypto-random-uuid": "warn",
    "effecttsgo/crypto-random-uuid-in-effect": "warn",
    "effecttsgo/deterministic-keys": "warn",
    "effecttsgo/effect-do-notation": "warn",
    "effecttsgo/extends-native-error": "warn",
    "effecttsgo/global-console": "warn",
    "effecttsgo/global-console-in-effect": "warn",
    "effecttsgo/global-date": "warn",
    "effecttsgo/global-date-in-effect": "warn",
    "effecttsgo/global-fetch": "warn",
    "effecttsgo/global-fetch-in-effect": "warn",
    "effecttsgo/global-random": "warn",
    "effecttsgo/global-random-in-effect": "warn",
    "effecttsgo/global-timers": "warn",
    "effecttsgo/global-timers-in-effect": "warn",
    "effecttsgo/instance-of-schema": "warn",
    "effecttsgo/missed-pipeable-opportunity": "warn",
    "effecttsgo/nested-effect-gen-yield": "warn",
    "effecttsgo/new-promise": "warn",
    "effecttsgo/node-builtin-import": "warn",
    "effecttsgo/prefer-barrel-import": "warn",
    "effecttsgo/prefer-schema-over-json": "warn",
    "effecttsgo/prefer-schema-tagged-error": "warn",
    "effecttsgo/prefer-schema-type-property": "warn",
    "effecttsgo/process-env": "warn",
    "effecttsgo/process-env-in-effect": "warn",
    // A brand keeps two Schema classes of the same shape apart. Errors are
    // kept apart by their `_tag`, and the demo domain's two value classes
    // have different shapes.
    "effecttsgo/schema-class-missing-brand": "off",
    "effecttsgo/schema-sync": "warn",
    "effecttsgo/service-not-as-class": "warn",
    // Services provide their layers once, when their own layer is built.
    "effecttsgo/strict-effect-provide": "warn",
    "effecttsgo/unsafe-effect-type-assertion": "error",
    // Effect tags its reactivity, HTTP, RPC and persistence modules
    // @stability unstable, and this library mirrors those tags on its own
    // exports, so every use of it would be flagged.
    "effecttsgo/unstable-api-usage": "off",
    // Misreads Effect.forEach(items, f) as Array#forEach.
    "github/array-foreach": "off",
    // Fires on a preventDefault() that runs before the handler's first await.
    "github/async-preventdefault": "off",
    // unicorn/filename-case checks file names; this one rejects SvelteKit's
    // +page.ts and any name with more than one dot, such as x.browser.test.ts.
    "github/filenames-match-regex": "off",
    // Window size and scroll position have no observer to watch them.
    "github/prefer-observers": "off",
    // Effect's data types are tagged unions with many members, such as the
    // inspector's Event.
    "sonarjs/max-union-size": "off",
    // Effect models absence as undefined (Option.getOrUndefined, optional
    // fields), not null.
    "sonarjs/no-undefined-assignment": "off",
    // Effect's modules are read through namespace imports (import * as
    // Option) and re-exported with export * as.
    "sonarjs/no-wildcard-import": "off",
    "typescript/switch-exhaustiveness-check": [
      "error",
      { requireDefaultForNonUnion: true },
    ],
    // Misreads Effect.forEach(items, f) as Array#forEach with a thisArg.
    "unicorn/no-array-method-this-argument": "off",
    // Effect requires an explicit undefined for a void argument, such as an
    // RPC with no payload; the autofix deletes it and breaks the types.
    "unicorn/no-useless-undefined": ["error", { checkArguments: false }],
  },
});
