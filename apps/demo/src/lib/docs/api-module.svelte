<script lang="ts">
  import type { ApiModuleHtml } from "../../../vite/api-reference.ts";
  import PageDescription from "./page-description.svelte";

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

<PageDescription
  description={module.name === "index"
    ? "The API reference for effect-atom-svelte: every export, with its signature and examples."
    : `The ${title} module in the effect-atom-svelte API reference: every export, with its signature and examples.`}
/>

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
        <p>
          <strong>Example</strong>{#if example.title}&nbsp;({example.title}){/if}
        </p>
        {@html example.html}
      {/each}
      {@render since(entry)}
    {/each}
  {/each}

  <!-- Another package's modules, re-exported together: one description, then the names. -->
  {#each module.reExports as group (group.from)}
    <h2 id={slug(group.category)}>{capitalize(group.category)}</h2>
    {@html group.description}
    <p>
      Re-exported from <code>{group.from}</code>. Each links to its source in Effect, where it is
      documented.
    </p>
    <table>
      <thead>
        <tr><th>Module</th><th>Source</th></tr>
      </thead>
      <tbody>
        {#each group.modules as entry (entry.name)}
          <tr id={entry.name}>
            <td><code>{entry.name}</code></td>
            <td><a href={entry.source}>{group.from}/{entry.name}.ts</a></td>
          </tr>
        {/each}
      </tbody>
    </table>
    {@render since(group)}
  {/each}
</div>

{#snippet since(entry: { since: string; stability?: string | undefined })}
  <p class="text-sm text-muted-foreground">
    Since v{entry.since}{#if entry.stability}&ensp;·&ensp;{capitalize(entry.stability)}{/if}
  </p>
{/snippet}
