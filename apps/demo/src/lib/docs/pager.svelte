<script lang="ts">
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
  import { page } from "$app/state";
  import { neighbors } from "#lib/docs/nav.ts";

  const links = $derived(neighbors(page.url.pathname));
</script>

<!--
  The previous and next pages, in a row ruled right across the docs page from line to line. The
  links sit side by side under the column's text, as two cells of one width that together span it,
  with a line on each side and a cross where each meets the row's lines; the row is empty out to its
  ends. The footer's
  top line, right below, is the row's bottom one. On a phone the cells stack, full width.
-->
{#if links.previous || links.next}
  <nav aria-label="Pages" class="pager relative mt-16 border-t">
    <i class="rule-cross rule-start"></i>
    <i class="rule-cross rule-end"></i>
    <div class="links">
      {#if links.previous}
        <a class="cell previous" href={links.previous.href} rel="prev">
          {@render edges()}
          <span class="docs-label flex items-center gap-1.5">
            <ArrowLeftIcon class="size-3.5" /> Previous
          </span>
          <span class="title">{links.previous.title}</span>
        </a>
      {/if}
      {#if links.next}
        <a class="cell next" href={links.next.href} rel="next">
          {@render edges()}
          <span class="docs-label flex items-center gap-1.5">
            Next <ArrowRightIcon class="size-3.5" />
          </span>
          <span class="title">{links.next.title}</span>
        </a>
      {/if}
    </div>
  </nav>
{/if}

<!-- A cell's crosses: where its side lines meet the row's top and bottom lines. -->
{#snippet edges()}
  <i class="rule-cross edge start" style:top="-1px"></i>
  <i class="rule-cross edge start" style:top="100%"></i>
  <i class="rule-cross edge end" style:top="-1px"></i>
  <i class="rule-cross edge end" style:top="100%"></i>
{/snippet}

<style>
  /* From the sidebar's edge to the table of contents' line (app.css, .docs-column). */
  .pager {
    margin-inline: calc(-1 * var(--reach));
  }
  .links {
    display: flex;
    flex-direction: column;
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
  /* Stacked on a phone: a line between the two, and no sides of their own. */
  .cell + .cell {
    border-top: 1px solid var(--border);
  }
  .edge {
    display: none;
  }
  /* Side by side, together as wide as the column's text (the row reaches --reach past it on
     each side), each half of it; a lone link is half as wide, in the middle. Each has a line on
     both sides; the second's left line is the first's right one. */
  @media (width >= 40rem) {
    .links {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin-inline: var(--reach);
    }
    .cell:only-child {
      grid-column: 1 / -1;
      justify-self: center;
      width: 50%;
    }
    .cell {
      border-right: 1px solid var(--border);
    }
    .cell:first-child {
      border-left: 1px solid var(--border);
    }
    .cell + .cell {
      border-top: 0;
    }
    .edge {
      display: block;
    }
    .edge.start {
      left: 0;
    }
    .edge.end {
      left: calc(100% - 1px);
    }
    /* The second cell's left line is the first's right one, which has its crosses already. */
    .cell + .cell .edge.start {
      display: none;
    }
  }
  .title {
    color: var(--foreground);
    font-size: 1.125rem;
    font-weight: 500;
  }
</style>
