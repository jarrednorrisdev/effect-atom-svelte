/** The hosted docs site, for canonical links, link previews and the sitemap. */
export const siteUrl = "https://atom.jarrednorris.dev";

export const siteName = "effect-atom-svelte";

/**
 * A hash of static/og-image.png, which scripts/brand-images.mjs rewrites when it redraws the image.
 * A new image gets a new URL, so Discord and the rest fetch it rather than show their cached copy.
 */
const previewVersion = "3df413b9";

/** The image link previews show (`static/og-image.png`, drawn by scripts/brand-images.mjs). */
export const previewImage = {
  alt: "effect-atom-svelte: write it in Effect, read it in any component. Svelte 5 bindings for Effect Atom.",
  height: 630,
  url: `${siteUrl}/og-image.png?v=${previewVersion}`,
  width: 1200,
} as const;
