import { defineConfig } from "oxfmt";

import { ignorePatterns } from "./lint/ignores.ts";

export default defineConfig({
  arrowParens: "always",
  bracketSameLine: false,
  bracketSpacing: true,
  endOfLine: "lf",
  ignorePatterns,
  jsxSingleQuote: false,
  overrides: [
    {
      // The Forms page shows these files in code frames that fit
      // about 62 characters before scrolling sideways.
      excludeFiles: ["apps/demo/src/routes/forms/+page.*"],
      files: ["apps/demo/src/routes/forms/*"],
      options: { printWidth: 62 },
    },
  ],
  printWidth: 80,
  proseWrap: "never",
  quoteProps: "as-needed",
  semi: true,
  singleQuote: false,
  sortImports: {
    ignoreCase: true,
    newlinesBetween: true,
    order: "asc",
  },
  sortPackageJson: true,
  sortTailwindcss: {
    functions: ["clsx", "cva", "tw", "twMerge", "cn", "twJoin", "tv"],
  },
  svelte: true,
  tabWidth: 2,
  trailingComma: "es5",
  useTabs: false,
});
