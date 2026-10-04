<script lang="ts">
  /**
   * A page's description, for search engines and link previews. The root layout sets every other
   * head tag; only a page knows its description, and each page renders this once, so the head never
   * gets two.
   */
  const { description }: { description: string } = $props();
</script>

<svelte:head>
  <meta content={description} name="description" />
  <meta content={description} property="og:description" />
  <meta content={description} name="twitter:description" />
</svelte:head>
