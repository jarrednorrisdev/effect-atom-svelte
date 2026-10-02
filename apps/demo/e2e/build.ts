import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/** Builds the demo once; every worker then previews this production build. */
export default function build() {
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
    { cwd: fileURLToPath(new URL("..", import.meta.url)), stdio: "inherit" }
  );
}
