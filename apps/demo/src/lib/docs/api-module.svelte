<script lang="ts">
  import type { ApiModuleHtml } from "../../../vite/api-reference.ts";
  import PageDescription from "./page-description.svelte";

  /**
   * A module's page in the API reference: its exports grouped by category. Everything in it was
   * read from the library's source and rendered at build time (`vite/api-reference.ts`).
   */
  const { module }: { module: ApiModuleHtml } = $props();

  // The index module is what `effect-atom-svelte` itself exports; its page is the overview.
  const title = $derived(module.name === "index" ? "API overview" : module.name);

  const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
  const slug = (text: string) => text.toLowerCase().replaceAll(/\s+/gu, "-");
</script>

<PageDescription
  description={module.name === "index"
    ? "The API reference for effect-atom-svelte: its entry points, and every export with its signature and examples."
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

  {#if module.entryPoints}
    <h2 id="entry-points">Entry points</h2>
    <p>
      An app imports from these entry points, the <code>exports</code> in the package's
      <code>package.json</code>:
    </p>
    <table>
      <thead>
        <tr><th>Import from</th><th>What it has</th></tr>
      </thead>
      <tbody>
        {#each module.entryPoints as entry (entry.from)}
          <tr>
            <td><a href={entry.href}><code>{entry.from}</code></a></td>
            <td>{@html entry.summary}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    <p>
      Each export says the version that added it. The package isn't published yet, and 0.1.0 is
      its first planned release, so every export says since v0.1.0.
    </p>
  {/if}

  {#each module.categories as category (category.title)}
    <h2 id={slug(category.title)}>{capitalize(category.title)}</h2>
    {#each category.exports as entry (entry.name)}
      <h3 id={entry.name}>{entry.name}</h3>
      {@html entry.description}
      {#if entry.guide}
        <p>Guide: <a href={entry.guide.href}>{entry.guide.title}</a></p>
      {/if}
      <!-- An `export *` has no signature worth showing, only its module's page. -->
      {#if entry.module}
        <p>See <a href={entry.module}>{entry.name}</a> for what it exports.</p>
      {:else}
        {@html entry.signature}
      {/if}
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
      Re-exported from <code>{group.from}</code>. Each links to the guide that teaches it, and to
      its source in Effect, where it is documented.
    </p>
    <table>
      <thead>
        <tr><th>Module</th><th>Guide</th><th>Source</th></tr>
      </thead>
      <tbody>
        {#each group.modules as entry (entry.name)}
          <tr id={entry.name}>
            <td><code>{entry.name}</code></td>
            <td>
              {#if entry.guide}<a href={entry.guide.href}>{entry.guide.title}</a>{/if}
            </td>
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
