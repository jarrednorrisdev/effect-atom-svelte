<script lang="ts">
  import { page } from "$app/state";
</script>

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
    Go to the <a href="/">introduction</a>, pick a page from the sidebar, or press
    <kbd>Ctrl</kbd>&nbsp;<kbd>K</kbd> to search.
  </p>
</div>
