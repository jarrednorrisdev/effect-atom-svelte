import { llmsIndex } from "#lib/docs/llms.ts";

// Built from the docs' Markdown at build time, so it is prerendered.
export const prerender = true;

export const GET = () =>
  new Response(llmsIndex(), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
