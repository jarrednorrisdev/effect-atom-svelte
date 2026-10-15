import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  // shadcn-svelte's generated components, as in oxlint.config.ts.
  ignorePatterns: [
    ...(ultracite.ignorePatterns ?? []),
    "apps/demo/src/lib/components/ui/**",
    "apps/demo/src/lib/hooks/is-mobile.svelte.ts",
    // Agent instructions and skills, some of them third-party (.claude/skills/NOTICE.md): kept as
    // their authors wrote them, as in oxlint.config.ts.
    ".claude/**",
  ],
});
