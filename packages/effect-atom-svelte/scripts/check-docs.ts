// Fails when a module in src lacks a header doc with @since, or an export lacks @since and @category,
// following the conventions of Effect's own packages.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const src = path.join(import.meta.dir, "..", "src");
const problems: string[] = [];

for (const file of readdirSync(src).filter((name) => name.endsWith(".ts"))) {
  const lines = readFileSync(path.join(src, file), "utf-8").split("\n");
  const header = lines.slice(0, lines.indexOf(" */") + 1).join("\n");
  if (!(lines[0] === "/**" && header.includes("@since"))) {
    problems.push(`${file}: missing a module doc with @since`);
  }
  let doc = "";
  let inDoc = false;
  let previousExport = "";
  for (const [index, line] of lines.entries()) {
    if (line.startsWith("/**")) {
      inDoc = true;
      doc = "";
    }
    if (inDoc) {
      doc += `${line}\n`;
      if (line.includes("*/")) {
        inDoc = false;
      }
      continue;
    }
    // `export *` and `export { … }` lines have no name, so two in a row are each checked rather
    // than taken for overloads of one export.
    const match =
      /^export (?:declare )?(?:(?:const|function|interface|type|class)\s+(?<name>\w+)|\*|\{)/u.exec(
        line
      );
    const name = match ? (match.groups?.name ?? "") : undefined;
    if (name === undefined) {
      if (line.trim() !== "") {
        doc = "";
      }
      continue;
    }
    // Overload signatures share the doc on the first one.
    if (name !== "" && name === previousExport) {
      continue;
    }
    previousExport = name;
    if (!(doc.includes("@since") && doc.includes("@category"))) {
      problems.push(
        `${file}:${index + 1}: ${name ? `export ${name}` : line.trim()} needs @since and @category`
      );
    }
    doc = "";
  }
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("docs: every module and export is tagged");
