<script lang="ts">
  import { afterNavigate } from "$app/navigation";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";

  import Toc from "./toc.svelte";
  import type { TableOfContents } from "./toc.svelte.ts";

  /**
   * "On this page" for screens too narrow for the column beside the page: a bar that stays under
   * the header, names the current section, and opens the list of sections.
   */
  const { toc }: { toc: TableOfContents } = $props();

  let open = $state(false);
  const current = $derived(
    toc.entries.find((entry) => entry.id === toc.active)?.title
  );

  afterNavigate(() => (open = false));
</script>

{#if toc.entries.length > 0}
  <details
    bind:open
    class="toc-menu bg-background sticky top-14 z-[16] -mt-10 mb-8 border-b text-sm xl:hidden"
  >
    <summary class="flex h-11 cursor-pointer list-none items-center gap-2">
      <span class="text-navigation-heading font-semibold whitespace-nowrap"
        >On this page</span
      >
      <ChevronRightIcon
        class="toc-menu-chevron text-muted-foreground size-4 shrink-0 transition-transform"
      />
      {#if current}<span class="text-muted-foreground truncate">{current}</span
        >{/if}
    </summary>
    <nav
      aria-label="On this page"
      class="max-h-[60svh] overflow-y-auto pt-1 pb-4"
    >
      <Toc onnavigate={() => (open = false)} {toc} />
    </nav>
  </details>
{/if}

<style>
  /* Right across the docs page, like its rules (app.css, .docs-column). */
  .toc-menu {
    margin-inline: calc(-1 * var(--reach));
    padding-inline: var(--reach);
  }
  .toc-menu summary::-webkit-details-marker {
    display: none;
  }
  .toc-menu[open] :global(.toc-menu-chevron) {
    rotate: 90deg;
  }
</style>
