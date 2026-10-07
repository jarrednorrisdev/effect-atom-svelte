import { error } from "@sveltejs/kit";

import { markdownHrefs, pageMarkdown } from "#lib/docs/llms.ts";

import type { EntryGenerator, RequestHandler } from "./$types";

// Built from the docs' Markdown at build time, so it is prerendered.
export const prerender = true;

// `/streams.md`; the reference's modules have a route of their own, under /reference.
export const entries: EntryGenerator = () =>
  markdownHrefs
    .filter((href) => !href.startsWith("/reference/"))
    .map((href) => ({ page: href.slice(1, -".md".length) }));

export const GET: RequestHandler = ({ params }) => {
  const text = pageMarkdown(`/${params.page}.md`);
  if (text === undefined) {
    error(404, `No page ${params.page}`);
  }
  return new Response(text, {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
};
