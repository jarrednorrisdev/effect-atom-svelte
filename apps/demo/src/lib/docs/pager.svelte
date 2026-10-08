<script lang="ts">
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
  import { page } from "$app/state";
  import { neighbors } from "#lib/docs/nav.ts";

  const links = $derived(neighbors(page.url.pathname));
</script>

<!--
  The previous and next pages, in a row ruled right across the docs page from line to line. Each
  link is a cell as wide as its text, at its end of the row: the row's end line is one side of it,
  and a line of its own, with a cross where it meets the row's, is the other. The footer's top
  line, right below, is the row's bottom one. On a phone the cells stack, full width.
-->
{#if links.previous || links.next}
  <nav aria-label="Pages" class="pager relative mt-16 flex border-t">
    <i class="rule-cross rule-start"></i>
    <i class="rule-cross rule-end"></i>
    {#if links.previous}
      <a class="cell previous" href={links.previous.href} rel="prev">
        <i class="rule-cross edge" style:top="-1px"></i>
        <i class="rule-cross edge" style:top="100%"></i>
        <span class="docs-label flex items-center gap-1.5">
          <ArrowLeftIcon class="size-3.5" /> Previous
        </span>
        <span class="title">{links.previous.title}</span>
      </a>
    {/if}
    {#if links.next}
      <a class="cell next" href={links.next.href} rel="next">
        <i class="rule-cross edge" style:top="-1px"></i>
        <i class="rule-cross edge" style:top="100%"></i>
        <span class="docs-label flex items-center gap-1.5">
          Next <ArrowRightIcon class="size-3.5" />
        </span>
        <span class="title">{links.next.title}</span>
      </a>
    {/if}
  </nav>
{/if}

<style>
  /* From the sidebar's edge to the table of contents' line (app.css, .docs-column). */
  .pager {
    flex-direction: column;
    margin-inline: calc(-1 * var(--reach));
  }
  .cell {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 1.75rem var(--pad);
    position: relative;
    transition: background-color 150ms;
  }
  .cell:hover {
    background: color-mix(in oklab, var(--brand) 4%, var(--background));
  }
  .cell:hover .title {
    color: var(--brand-text);
  }
  .next {
    align-items: flex-end;
    text-align: right;
  }
  /* Stacked on a phone: a line between the two, and no ends of their own. */
  .cell + .cell {
    border-top: 1px solid var(--border);
  }
  .edge {
    display: none;
  }
  /* Side by side: each cell as wide as its text, at its end of the row, with its own end line. */
  @media (width >= 40rem) {
    .pager {
      flex-direction: row;
      justify-content: space-between;
    }
    .cell {
      min-width: 14rem;
    }
    .cell + .cell {
      border-top: 0;
    }
    .previous {
      border-right: 1px solid var(--border);
    }
    .next {
      border-left: 1px solid var(--border);
      margin-left: auto;
    }
    .edge {
      display: block;
    }
    .previous .edge {
      left: calc(100% - 1px);
    }
    .next .edge {
      left: 0;
    }
  }
  .title {
    color: var(--foreground);
    font-size: 1.125rem;
    font-weight: 500;
  }
</style>
