import { pages } from "#lib/docs/nav.ts";
import { siteUrl } from "#lib/docs/site.ts";

// The landing page and the sidebar, which lists every other page, so it is prerendered.
export const prerender = true;

export const GET = () =>
  new Response(
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...["/", ...pages.map(({ href }) => href)].map(
        (href) => `  <url><loc>${siteUrl}${href}</loc></url>`
      ),
      "</urlset>",
      "",
    ].join("\n"),
    { headers: { "content-type": "application/xml" } }
  );
