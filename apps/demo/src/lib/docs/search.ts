/**
 * Pagefind, loaded on demand from the index `vite/pagefind.ts` writes after prerendering. It
 * indexes the prerendered pages, and the sidebar's other pages from their Markdown. The index only
 * exists in a build: `vite dev` has none.
 */

/** A part of a page under one heading. */
export interface PagefindSubResult {
  readonly excerpt: string;
  readonly title: string;
  readonly url: string;
}

/** A page's search data. `excerpt` is HTML: escaped text with the matches in `<mark>`. */
export interface PagefindResultData {
  readonly excerpt: string;
  readonly meta: { readonly title?: string };
  readonly sub_results: readonly PagefindSubResult[];
  readonly url: string;
}

interface PagefindResult {
  readonly data: () => Promise<PagefindResultData>;
  readonly id: string;
}

interface Pagefind {
  /** Resolves to `null` when a later call superseded this one. */
  readonly debouncedSearch: (
    term: string
  ) => Promise<{ readonly results: readonly PagefindResult[] } | null>;
}

const importPagefind = async (): Promise<Pagefind | undefined> => {
  // A variable, so Vite leaves the import alone: the file only exists after a build.
  const path = "/pagefind/pagefind.js";
  try {
    // oxlint-disable-next-line eslint/no-inline-comments -- Vite reads this comment inside import()
    return (await import(/* @vite-ignore */ path)) as Pagefind;
  } catch {
    return undefined;
  }
};

let loading: Promise<Pagefind | undefined> | undefined;

/** Pagefind's browser API, or `undefined` when the site has no index (in dev). */
export const loadPagefind = () => {
  loading ??= importPagefind();
  return loading;
};

/** Pagefind's URLs point at the prerendered files (`/reading-and-writing.html#writing`); the routes have no `.html`. */
export const routeUrl = (url: string) => url.replace(/\.html(?=#|$)/u, "");
