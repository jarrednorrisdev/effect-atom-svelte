/** A heading in the table of contents. */
export interface TocEntry {
  readonly depth: number;
  readonly id: string;
  readonly title: string;
}

const slug = (text: string) =>
  text
    .toLowerCase()
    .trim()
    .replaceAll(/[^\w\s-]/gu, "")
    .replaceAll(/\s+/gu, "-");

/**
 * Markdown headings get ids at build time (rehype-slug); headings in Svelte pages get one here,
 * so the table of contents can link to them.
 */
const collect = (element: HTMLElement): readonly TocEntry[] =>
  [...element.querySelectorAll<HTMLHeadingElement>("h2, h3")]
    .filter((heading) => !heading.closest("[data-example]"))
    .map((heading) => {
      heading.id ||= slug(heading.textContent ?? "");
      return {
        depth: heading.tagName === "H2" ? 2 : 3,
        id: heading.id,
        title: heading.textContent?.trim() ?? "",
      };
    });

const same = (a: readonly TocEntry[], b: readonly TocEntry[]) =>
  a.length === b.length &&
  a.every(
    (entry, index) =>
      entry.id === b[index]?.id && entry.title === b[index]?.title
  );

/**
 * The h2 and h3 headings in the page's content (except inside live examples) and the one the
 * reader is in. Create it while a component initializes; the column beside the page and the menu
 * above it on smaller screens both show it.
 */
export class TableOfContents {
  entries = $state<readonly TocEntry[]>([]);
  /** The current section: the last heading scrolled past the header. */
  active = $state<string>();

  constructor(root: () => HTMLElement | undefined) {
    // Pages render async content and toggle sections, so watch the content rather than the route.
    $effect(() => {
      const element = root();
      if (!element) {
        return;
      }
      let frame = 0;
      const update = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          const next = collect(element);
          if (!same(this.entries, next)) {
            this.entries = next;
          }
        });
      };
      update();
      const observer = new MutationObserver(update);
      observer.observe(element, { childList: true, subtree: true });
      return () => {
        observer.disconnect();
        cancelAnimationFrame(frame);
      };
    });

    $effect(() => {
      const ids = this.entries.map((entry) => entry.id);
      const onScroll = () => {
        let [current] = ids;
        for (const id of ids) {
          const heading = document.querySelector(`#${CSS.escape(id)}`);
          if (heading && heading.getBoundingClientRect().top < 120) {
            current = id;
          }
        }
        this.active = current;
      };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => window.removeEventListener("scroll", onScroll);
    });
  }
}
