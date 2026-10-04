<script lang="ts">
  import type { TableOfContents } from "./toc.svelte.ts";

  /** The page's sections, as a list of links with the current one marked. */
  const { onnavigate, toc }: { onnavigate?: () => void; toc: TableOfContents } = $props();
</script>

<ul class="space-y-2 border-l">
  {#each toc.entries as entry (entry.id)}
    <li>
      <!-- The active and inactive colours are alternatives: both on one element, the inactive
           ones won and the highlight never showed. -->
      <a
        aria-current={toc.active === entry.id ? "location" : undefined}
        class={[
          "-ml-px block border-l transition-colors hover:text-foreground",
          entry.depth === 3 ? "pl-6" : "pl-3",
          toc.active === entry.id
            ? "border-brand text-foreground"
            : "border-transparent text-navigation-foreground",
        ]}
        href="#{entry.id}"
        onclick={onnavigate}
      >
        {entry.title}
      </a>
    </li>
  {/each}
</ul>
