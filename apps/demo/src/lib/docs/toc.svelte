<script lang="ts">
  import type { TableOfContents } from "./toc.svelte.ts";

  /** The page's sections, as a list of links with the current one marked. */
  const { onnavigate, toc }: { onnavigate?: () => void; toc: TableOfContents } = $props();

  // Each h2's number, as the page shows it above the heading (app.css, .docs-column h2).
  const numbers = $derived.by(() => {
    let count = 0;
    return new Map(
      toc.entries.map((entry) => [
        entry.id,
        entry.depth === 2 ? String((count += 1)).padStart(2, "0") : undefined,
      ])
    );
  });
</script>

<ul class="space-y-2 border-l">
  {#each toc.entries as entry (entry.id)}
    <li>
      <!-- The active and inactive colors are alternatives: both on one element, the inactive
           ones won and the highlight never showed. -->
      <a
        aria-current={toc.active === entry.id ? "location" : undefined}
        class={[
          "-ml-px flex gap-2.5 border-l transition-colors hover:text-foreground",
          entry.depth === 3 ? "pl-[2.6rem]" : "pl-3",
          toc.active === entry.id
            ? "border-brand text-foreground"
            : "border-transparent text-navigation-foreground",
        ]}
        href="#{entry.id}"
        onclick={onnavigate}
      >
        <!-- The number is drawn by CSS, so it isn't part of the link's text. -->
        {#if numbers.get(entry.id)}
          <span class="number" data-number={numbers.get(entry.id)}></span>
        {/if}
        <span>{entry.title}</span>
      </a>
    </li>
  {/each}
</ul>


<style>
  .number::before {
    color: var(--brand-text);
    content: attr(data-number) / "";
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
    line-height: 1rem;
  }
  .number {
    display: block;
    padding-top: 1px;
  }
</style>
