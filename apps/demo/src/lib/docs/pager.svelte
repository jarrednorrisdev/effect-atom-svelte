<script lang="ts">
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
  import { page } from "$app/state";
  import { neighbors } from "#lib/docs/nav.ts";

  const links = $derived(neighbors(page.url.pathname));
</script>

<!--
  The previous and next pages, as two cells ruled right across the docs page from line to line, like
  the landing page's Get started; their text lines up with the column's. The footer's top line,
  right below, is their bottom one.
-->
{#if links.previous || links.next}
  <nav aria-label="Pages" class="pager relative mt-16 grid border-t sm:grid-cols-2">
    <i class="rule-cross rule-start"></i>
    <i class="rule-cross rule-end"></i>
    <i class="rule-cross pager-middle" style:left="50%" style:top="-1px"></i>
    <i class="rule-cross pager-middle" style:left="50%" style:top="100%"></i>
    {#if links.previous}
      <a class="cell" href={links.previous.href} rel="prev">
        <span class="docs-label flex items-center gap-1.5">
          <ArrowLeftIcon class="size-3.5" /> Previous
        </span>
        <span class="title">{links.previous.title}</span>
      </a>
    {:else}
      <span class="cell hidden sm:block"></span>
    {/if}
    {#if links.next}
      <a class="cell next" href={links.next.href} rel="next">
        <span class="docs-label flex items-center gap-1.5">
          Next <ArrowRightIcon class="size-3.5" />
        </span>
        <span class="title">{links.next.title}</span>
      </a>
    {/if}
  </nav>
{/if}

<style>
  /* From the sidebar's edge to the table of contents' line (app.css, .docs-column), with the
     cells' text in line with the column's. */
  .pager {
    margin-inline: calc(-1 * var(--reach));
    padding-inline: calc(var(--reach) - var(--pad));
  }
  .cell {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 1.75rem var(--pad);
    transition: background-color 150ms;
  }
  a.cell:hover {
    background: color-mix(in oklab, var(--brand) 4%, var(--background));
  }
  a.cell:hover .title {
    color: var(--brand-text);
  }
  .next {
    align-items: flex-end;
    text-align: right;
  }
  .cell + .cell {
    border-top: 1px solid var(--border);
  }
  @media (width >= 40rem) {
    .cell + .cell {
      border-left: 1px solid var(--border);
      border-top: 0;
    }
  }
  .title {
    color: var(--foreground);
    font-size: 1.125rem;
    font-weight: 500;
  }
  /* The middle line only exists while the cells sit side by side. */
  @media (width < 40rem) {
    .pager-middle {
      display: none !important;
    }
  }
</style>
