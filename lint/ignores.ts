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
  // Agent instructions and skills. Most skills are vendored from jnd-skills
  // (`.claude/skills/jnd-skills.lock.json`), so a local fix would show as a
  // tweak at the next sync.
  ".claude/**",
  // Explainer-diagram specs and their glossary: data in the skill's own style,
  // built by its scripts, not part of the packages.
  "docs/diagrams/**",
];
