<script lang="ts">
  /** The headings to list: h2 and h3 in `root`, except inside live examples. */
  const { root }: { root: HTMLElement | undefined } = $props();

  /** A heading in the table of contents. */
  interface Entry {
    readonly depth: number;
    readonly id: string;
    readonly title: string;
  }

  let entries = $state<readonly Entry[]>([]);
  let active = $state<string>();

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
  const collect = (element: HTMLElement): readonly Entry[] =>
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

  const same = (a: readonly Entry[], b: readonly Entry[]) =>
    a.length === b.length &&
    a.every((entry, index) => entry.id === b[index]?.id && entry.title === b[index]?.title);

  // Pages render async content and toggle sections, so watch the content rather than the route.
  $effect(() => {
    if (!root) {
      return;
    }
    const element = root;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = collect(element);
        if (!same(entries, next)) {
          entries = next;
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

  // The current section is the last heading scrolled past the header.
  $effect(() => {
    const ids = entries.map((entry) => entry.id);
    const onScroll = () => {
      let [current] = ids;
      for (const id of ids) {
        const heading = document.querySelector(`#${CSS.escape(id)}`);
        if (heading && heading.getBoundingClientRect().top < 120) {
          current = id;
        }
      }
      active = current;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  });
</script>

{#if entries.length > 0}
  <nav aria-label="On this page" class="text-sm">
    <h2 class="mb-3 font-semibold text-navigation-heading">On this page</h2>
    <ul class="space-y-2 border-l">
      {#each entries as entry (entry.id)}
        <li>
          <!-- The active and inactive colours are alternatives: both on one element, the inactive
               ones won and the highlight never showed. -->
          <a
            aria-current={active === entry.id ? "location" : undefined}
            class={[
              "-ml-px block border-l transition-colors hover:text-foreground",
              entry.depth === 3 ? "pl-6" : "pl-3",
              active === entry.id
                ? "border-brand text-foreground"
                : "border-transparent text-navigation-foreground",
            ]}
            href="#{entry.id}"
          >
            {entry.title}
          </a>
        </li>
      {/each}
    </ul>
  </nav>
{/if}
