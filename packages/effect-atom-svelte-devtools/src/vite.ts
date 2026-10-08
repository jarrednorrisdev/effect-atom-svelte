/**
 * The Vite plugin that names your atoms after the variables that hold them.
 *
 * @since 0.2.0
 */
import { existsSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createFilter, normalizePath } from "vite";
import type { FilterPattern, Plugin } from "vite";

import { labelAtoms, labelModule } from "./internal/transform.ts";

/**
 * Options for `atomLabels`.
 *
 * @since 0.2.0
 * @category models
 */
export interface AtomLabelsOptions {
  /** Files to label. Defaults to Svelte components and JavaScript and TypeScript modules. */
  readonly include?: FilterPattern | undefined;
  /** Files to leave alone. Defaults to anything in `node_modules`. */
  readonly exclude?: FilterPattern | undefined;
  /**
   * Labels production builds too, for an app that shows its atoms' names in production: the
   * effect-atom-svelte docs draw each example's graph. Off by default.
   */
  readonly builds?: boolean | undefined;
}

// ./internal/label.ts, or its build next to this file once the package is built.
const labelFile = (() => {
  const built = fileURLToPath(new URL("internal/label.js", import.meta.url));
  return existsSync(built)
    ? built
    : fileURLToPath(new URL("internal/label.ts", import.meta.url));
})();

/**
 * Labels each atom declared at the top level of a module, or of a component's `<script>` or
 * `<script module>`, with the name of its variable and where it is declared, for the devtools and
 * anything else that reads `atom.label`:
 *
 * ```ts
 * export const todosAtom = Atom.make(...)  // label: ["todosAtom", "at todosAtom (/src/lib/todos.ts:4:14)"]
 * ```
 *
 * The atom keeps its identity: it is labelled in place, not copied as `Atom.withLabel` does. A
 * label the code sets itself wins. Members of an `Atom.family` are labelled with their argument,
 * as `todoAtom(3)`.
 *
 * Only the dev server applies it, unless `builds` is set; production builds are left as they are,
 * and never keep values across reloads. Put it before
 * `sveltekit()` or `svelte()`, so it sees components before they are compiled.
 *
 * **Example** (Adding the plugin)
 *
 * ```ts
 * // vite.config.ts
 * import { sveltekit } from "@sveltejs/kit/vite";
 * import { atomLabels } from "effect-atom-svelte-devtools/vite";
 * import { defineConfig } from "vite";
 *
 * export default defineConfig({
 *   plugins: [atomLabels(), sveltekit()],
 * });
 * ```
 *
 * @since 0.2.0
 * @category plugins
 */
export const atomLabels = (options: AtomLabelsOptions = {}): Plugin => {
  const filter = createFilter(
    options.include ?? /\.(?:svelte|[cm]?[jt]s)$/u,
    options.exclude ?? /[\\/]node_modules[\\/]/u
  );
  let root = process.cwd();
  let serving = true;
  // This package's code and the library's aren't the app's, even when a workspace links them from
  // outside node_modules. Labelling the library would also loop: the label module imports it.
  // Not import.meta.dirname, which Node only has from 20.11; Vite 5 runs on Node 18.
  // oxlint-disable-next-line unicorn/prefer-import-meta-properties
  const here = fileURLToPath(new URL(".", import.meta.url));
  const packages = [normalizePath(here)];
  return {
    apply: (_, env) => options.builds === true || env.command === "serve",
    configResolved(config) {
      ({ root } = config);
      serving = config.command === "serve";
      try {
        const require = createRequire(path.join(root, "package.json"));
        const library = require.resolve("effect-atom-svelte/package.json");
        packages.push(`${normalizePath(path.dirname(realpathSync(library)))}/`);
      } catch {
        // The app can't resolve the library, so there is none of its code to skip.
      }
      const names = config.plugins.map((plugin) => plugin.name);
      const svelte = names.findIndex((name) =>
        name.startsWith("vite-plugin-svelte")
      );
      if (
        svelte !== -1 &&
        svelte < names.indexOf("effect-atom-svelte-devtools:labels")
      ) {
        config.logger.warn(
          "effect-atom-svelte-devtools: atomLabels() comes after the Svelte plugin, so atoms declared in components aren't labelled. Put it before sveltekit() or svelte()."
        );
      }
    },
    enforce: "pre",
    name: "effect-atom-svelte-devtools:labels",
    resolveId(id) {
      return id === labelModule ? labelFile : undefined;
    },
    transform(code, id) {
      // Ids with a query are other views of a file, such as a component's styles.
      if (
        id.includes("?") ||
        !filter(id) ||
        packages.some((directory) => id.startsWith(directory))
      ) {
        return undefined;
      }
      return labelAtoms(code, id, root, { keep: serving });
    },
  };
};
