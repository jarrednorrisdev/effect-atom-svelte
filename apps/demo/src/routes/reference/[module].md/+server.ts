import { error } from "@sveltejs/kit";

import { markdownHrefs, pageMarkdown } from "#lib/docs/llms.ts";

import type { EntryGenerator, RequestHandler } from "./$types";

// Built from the library's source at build time, so it is prerendered.
export const prerender = true;

// `/reference/Hooks.md`.
export const entries: EntryGenerator = () =>
  markdownHrefs
    .filter((href) => href.startsWith("/reference/"))
    .map((href) => ({
      module: href.slice("/reference/".length, -".md".length),
    }));

export const GET: RequestHandler = ({ params }) => {
  const text = pageMarkdown(`/reference/${params.module}.md`);
  if (text === undefined) {
    error(404, `No API reference for ${params.module}`);
  }
  return new Response(text, {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
};
