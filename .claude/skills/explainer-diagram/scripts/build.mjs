// Builds a self-contained diagram page from a spec module.
//
//   node <skill>/scripts/build.mjs <spec.mjs> <out.html>
//
// The page inlines the engine and styles, so it works in T3's html_render and on GitHub Pages,
// and a later engine change never alters a page already published.
//
// Besides its default export (the spec), a spec module can export its own box kinds and styles,
// for a picture the engine's kinds can't draw:
//
//   export const kinds = { timeline: { make(b) { … }, paint(e, s, b, animate) { … } } };
//   export const css = `.timeline { … }`;
//
// Their functions are copied into the page as source, so they can't use anything from the module
// around them.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [specPath, out] = process.argv.slice(2);
if (!specPath || !out) {
  console.error("usage: node build.mjs <spec.mjs> <out.html>");
  process.exit(2);
}
const engine = (name) => readFileSync(new URL(`../engine/${name}`, import.meta.url), "utf8");
const mod = await import(`${pathToFileURL(resolve(specPath)).href}?t=${Date.now()}`);

// A function's source, as a property of an object literal: a method keeps its own shorthand.
const prop = (key, fn) => {
  const src = fn.toString();
  return src.startsWith(`${key}(`) || src.startsWith(`${key} (`) ? src : `${JSON.stringify(key)}: ${src}`;
};
const kinds = Object.entries(mod.kinds ?? {})
  .map(([name, k]) => `${JSON.stringify(name)}: { ${Object.entries(k).map(([key, fn]) => prop(key, fn)).join(", ")} }`)
  .join(",\n");

// Every {{id}} a spec links must be one of its primer's terms: the engine would otherwise show the
// bare text, and the reader would lose the definition. Pick it from the glossary, or add it there.
const known = new Set((mod.default.primer?.terms ?? []).map((t) => t.id));
const missing = [...new Set([...JSON.stringify(mod.default).matchAll(/\{\{(\w+)/g)].map((m) => m[1]))]
  .filter((id) => !known.has(id));
if (missing.length > 0) {
  console.error(
    `${specPath} links terms its primer doesn't have: ${missing.join(", ")}.\n` +
      "Add each to the primer with terms(...) from glossary.mjs; one the glossary lacks goes in the glossary first (SKILL.md, \"The primer's terms\")."
  );
  process.exit(1);
}

// `<\/` keeps a "</script>" inside the spec's strings from ending the page's script.
const json = JSON.stringify(mod.default, null, 2).replace(/<\//g, "<\\/");
const html = engine("shell.html")
  .replace("/*STYLE*/", () => engine("stepper.css") + (mod.css ? `\n/* This diagram's own styles. */\n${mod.css}` : ""))
  .replace("/*ENGINE*/", () => engine("stepper.js"))
  .replace("/*SPEC*/", () => `${json}, {\n${kinds.replace(/<\//g, "<\\/")}\n}`);
writeFileSync(out, html);
console.log(`wrote ${out}`);
