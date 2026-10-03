import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/** Builds the demo for production, with `env` added to the build's environment. */
export const buildDemo = (env: NodeJS.ProcessEnv = {}) => {
  execFileSync(
    process.execPath,
    [
      fileURLToPath(
        new URL("../node_modules/vite/bin/vite.js", import.meta.url)
      ),
      "build",
      "--logLevel",
      "warn",
    ],
    {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      env: { ...process.env, ...env },
      stdio: "inherit",
    }
  );
};

/** Builds the demo once; every worker then previews this production build. */
export default function build() {
  buildDemo();
}
