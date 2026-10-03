<script lang="ts">
  import type { Snippet } from "svelte";

  /**
   * The layout mdsvex wraps every `.md` page in (`vite.config.ts`). It receives the page's
   * frontmatter: `title` becomes the heading and `description` the lead paragraph.
   */
  const {
    children,
    description,
    title,
  }: { children: Snippet; description?: string; title?: string } = $props();
</script>

<div class="prose prose-effect max-w-none">
  {#if title}<h1>{title}</h1>{/if}
  {#if description}<p class="lead">{description}</p>{/if}
  {@render children()}
</div>
