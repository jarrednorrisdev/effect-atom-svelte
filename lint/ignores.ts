/** Paths neither oxlint nor oxfmt should touch. */
export const ignorePatterns = [
  "**/node_modules",
  "**/.git",
  "**/dist",
  "**/build",
  "**/.svelte-kit",
  "**/.turbo",
  "**/.wrangler",
  "**/.alchemy",
  "**/.cache",
  "**/.vite",
  "**/coverage",
  "**/bun.lock",
  "**/bun.lockb",
  // A bundled copy of a third-party plugin.
  "lint/anti-slop/plugin.mjs",
  // shadcn-svelte's generated components: kept as the CLI writes them, so
  // `shadcn-svelte add` can update them.
  "apps/demo/src/lib/components/ui/**",
  "apps/demo/src/lib/hooks/is-mobile.svelte.ts",
  // Agent instructions and skills, some of them third-party
  // (.claude/skills/NOTICE.md).
  ".claude/**",
];
