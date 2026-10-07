<script lang="ts">
  import { page } from "$app/state";
  import { searchShortcut } from "#lib/docs/search-shortcut.svelte.ts";

  const shortcut = searchShortcut();
</script>

<svelte:head>
  <!-- Search engines leave error pages out. The root layout sets the title from the status. -->
  <meta content="noindex" name="robots" />
</svelte:head>

<!-- Rendered inside the root layout, so the header, sidebar and search stay available. -->
<div class="prose prose-effect max-w-none">
  {#if page.status === 404}
    <h1>Page not found</h1>
    <p class="lead">There is no page at <code>{page.url.pathname}</code>.</p>
  {:else}
    <h1>Something went wrong</h1>
    <p class="lead">{page.error?.message ?? "The page failed to load."}</p>
  {/if}
  <p>
    Go to the <a href="/introduction">introduction</a>, pick a page from the sidebar, or press
    <kbd>{shortcut.current}</kbd> to search.
  </p>
</div>
