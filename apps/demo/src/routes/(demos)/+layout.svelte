<script lang="ts">
  import type { Snippet } from "svelte";

  const { children }: { children: Snippet } = $props();
</script>

<!-- The demo pages as they were before the docs shell, until each is rewritten as a docs page with
     <Example>. `demo` styles their plain sections and form controls (app.css). -->
<div class="demo prose prose-effect max-w-none">
  {@render children()}
</div>
