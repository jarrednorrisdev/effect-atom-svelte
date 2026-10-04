/** A page in the sidebar. */
export interface NavPage {
  readonly href: string;
  readonly title: string;
}

/** A titled group of pages in the sidebar. */
export interface NavSection {
  readonly pages: readonly NavPage[];
  readonly title: string;
}

/** The sidebar, in reading order. Prev/next links, page titles and search suggestions use it too. */
export const nav: readonly NavSection[] = [
  {
    pages: [
      { href: "/", title: "Introduction" },
      { href: "/why-atoms", title: "Why atoms" },
      { href: "/installation", title: "Installation" },
      { href: "/first-atom", title: "Your first atom" },
    ],
    title: "Getting started",
  },
  {
    pages: [
      { href: "/reading-and-writing", title: "Reading and writing" },
      { href: "/derived-atoms", title: "Derived atoms" },
      { href: "/families", title: "Families" },
      { href: "/lifetimes", title: "Lifetimes" },
      { href: "/refs", title: "AtomRef" },
      { href: "/scoped-atoms", title: "Scoped atoms" },
      { href: "/browser", title: "Browser atoms" },
    ],
    title: "Atoms",
  },
  {
    pages: [
      { href: "/effect-basics", title: "Effect basics" },
      { href: "/async-atoms", title: "Async atoms" },
      { href: "/suspense", title: "Suspense" },
      { href: "/mutations", title: "Mutations" },
      { href: "/streams", title: "Streams" },
    ],
    title: "Async",
  },
  {
    pages: [
      { href: "/rpc", title: "RPC" },
      { href: "/http", title: "HTTP API" },
    ],
    title: "Effect services",
  },
  {
    pages: [
      { href: "/server-rendering", title: "Server rendering" },
      { href: "/hydration", title: "Hydration" },
      { href: "/sveltekit", title: "SvelteKit" },
    ],
    title: "Server rendering",
  },
  {
    pages: [{ href: "/errors", title: "Errors" }],
    title: "Guides",
  },
  {
    // Generated from the library's source by vite/api-reference.ts, which fails the build if a
    // module is missing here.
    pages: [
      { href: "/reference", title: "Overview" },
      { href: "/reference/Hooks", title: "Hooks" },
      { href: "/reference/RegistryContext", title: "RegistryContext" },
      { href: "/reference/ScopedAtom", title: "ScopedAtom" },
      { href: "/reference/SvelteKit", title: "SvelteKit" },
    ],
    title: "API reference",
  },
];

/** Every page, in reading order. */
export const pages: readonly NavPage[] = nav.flatMap(
  (section) => section.pages
);

/** The pages either side of `pathname`, for the links at the foot of a page. */
export interface Neighbours {
  readonly next: NavPage | undefined;
  readonly page: NavPage | undefined;
  readonly previous: NavPage | undefined;
}

export const neighbours = (pathname: string): Neighbours => {
  const index = pages.findIndex((page) => page.href === pathname);
  if (index === -1) {
    return { next: undefined, page: undefined, previous: undefined };
  }
  return {
    next: pages[index + 1],
    page: pages[index],
    previous: pages[index - 1],
  };
};
