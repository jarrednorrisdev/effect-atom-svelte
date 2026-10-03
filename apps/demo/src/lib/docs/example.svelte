<script lang="ts">
  import CheckIcon from "@lucide/svelte/icons/check";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import * as Tabs from "#lib/components/ui/tabs/index.ts";
  import type { Snippet } from "svelte";

  /** A source file of an example: its name, and its code from a `?highlight` import. */
  interface ExampleFile {
    readonly html: string;
    readonly name: string;
  }

  /**
   * A live example above its source. Import the source from the same files that render, so the
   * docs show the code that runs:
   *
   * ```svelte
   * <Example files={[{ html: counterSource, name: "counter.svelte" }]}>
   *   <Counter />
   * </Example>
   * ```
   */
  const { children, files }: { children: Snippet; files: readonly ExampleFile[] } = $props();

  // svelte-ignore state_referenced_locally
  let selected = $state(files[0]?.name ?? "");
  let code = $state<HTMLElement>();
  let copied = $state(false);
  const file = $derived(files.find((entry) => entry.name === selected) ?? files[0]);

  const copy = async () => {
    // Line numbers are CSS counters, so the text is just the code.
    await navigator.clipboard.writeText(code?.querySelector("code")?.textContent ?? "");
    copied = true;
    setTimeout(() => (copied = false), 2000);
  };
</script>

<figure class="example my-8" data-example>
  <!-- The live output is not indexed for search; the source below is. -->
  <div class="demo rounded-t-lg border border-b-0 p-6" data-pagefind-ignore="all">
    {@render children()}
  </div>
  <div class="group relative">
    <div class="not-prose flex items-end rounded-none border bg-muted/40 px-2">
      {#if files.length > 1}
        <Tabs.Root bind:value={selected}>
          <Tabs.List class="h-auto gap-0 p-0" variant="line">
            {#each files as entry (entry.name)}
              <Tabs.Trigger class="example-tab after:hidden" value={entry.name}>{entry.name}</Tabs.Trigger>
            {/each}
          </Tabs.List>
        </Tabs.Root>
      {:else}
        <span class="example-tab" data-active>{file?.name}</span>
      {/if}
    </div>
    <div bind:this={code} role="tabpanel">
      <!-- Highlighted at build time by vite/highlight.ts from the example's own files. -->
      {@html file?.html}
    </div>
    <button
      aria-label={copied ? "Copied" : "Copy code"}
      class="not-prose absolute top-12 right-2 flex size-8 items-center justify-center rounded-sm border bg-background/80 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-75 hover:opacity-100! focus-visible:opacity-100"
      onclick={copy}
      type="button"
    >
      {#if copied}<CheckIcon class="size-4 text-brand" />{:else}<CopyIcon class="size-4" />{/if}
    </button>
  </div>
</figure>

<style>
  /* An editor tab, as in effect.website's titled code frames. */
  :global(.example-tab) {
    background: transparent;
    border: 1px solid transparent;
    border-bottom: 0;
    border-radius: 0;
    color: var(--muted-foreground);
    flex: none;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    height: auto;
    margin-bottom: -1px;
    padding: 0.4rem 0.9rem;
    position: relative;
  }
  :global(.example-tab[data-active]),
  :global(.example-tab[data-state="active"]) {
    background: var(--background);
    border-color: var(--border);
    box-shadow: inset 0 2px 0 var(--brand);
    color: var(--foreground);
  }
  .example :global(.shiki) {
    border-radius: 0 0 var(--radius-lg) var(--radius-lg);
    border-top: 0;
    margin: 0;
  }
</style>
