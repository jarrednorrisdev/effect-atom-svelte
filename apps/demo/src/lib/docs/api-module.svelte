<script lang="ts">
  import type { ApiModuleHtml } from "../../../vite/api-reference.ts";

  /**
   * A module's page in the API reference: its exports grouped by category. Everything in it was
   * read from the library's source and rendered at build time (`vite/api-reference.ts`).
   */
  const { module }: { module: ApiModuleHtml } = $props();

  // The index module is what `effect-atom-svelte` itself exports.
  const title = $derived(module.name === "index" ? "effect-atom-svelte" : module.name);

  const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
  const slug = (text: string) => text.toLowerCase().replaceAll(/\s+/gu, "-");
</script>

<div class="prose prose-effect max-w-none">
  <h1>{title}</h1>
  <!-- The module's doc comment, from the library's source. -->
  {@html module.description}
  <p>
    {#if module.import.namespace}
      Import it as the <code>{module.import.namespace}</code> namespace from
      <code>{module.import.from}</code>.
    {:else}
      Import from <code>{module.import.from}</code>.
    {/if}
  </p>

  {#each module.categories as category (category.title)}
    <h2 id={slug(category.title)}>{capitalize(category.title)}</h2>
    {#each category.exports as entry (entry.name)}
      <h3 id={entry.name}>{entry.name}</h3>
      {@html entry.description}
      {#if entry.module}
        <p>See <a href={entry.module}>{entry.name}</a> for what it exports.</p>
      {/if}
      {@html entry.signature}
      {#each entry.examples as example, index (index)}
        <p><strong>Example</strong></p>
        {@html example}
      {/each}
      <p class="text-sm text-muted-foreground">
        Since v{entry.since}{#if entry.stability}&ensp;·&ensp;{capitalize(entry.stability)}{/if}
      </p>
    {/each}
  {/each}
</div>
