<script lang="ts">
  import type { Snippet } from "svelte";

  import PageDescription from "./page-description.svelte";

  /**
   * The layout mdsvex wraps every `.md` page in (`vite.config.ts`). It receives the page's
   * frontmatter: `title` becomes the heading and `description` the lead paragraph and the page's
   * meta description.
   */
  const {
    children,
    description,
    title,
  }: { children: Snippet; description?: string; title?: string } = $props();
</script>

{#if description}<PageDescription {description} />{/if}

<div class="prose prose-effect max-w-none">
  {#if title}<h1>{title}</h1>{/if}
  {#if description}<p class="lead">{description}</p>{/if}
  {@render children()}
</div>
