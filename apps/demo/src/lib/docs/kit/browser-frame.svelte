<!--
  @component
  A small browser window around a tiny app, for examples about moving between pages: an address
  bar showing the current page, and a row of page links. The example keeps the page in its own
  state and renders that page as the children; the frame only draws the window and the links.

  ```svelte
  <BrowserFrame bind:page pages={["inbox", "chat"]}>
    {#if page === "chat"}<ChatPage />{:else}<InboxPage />{/if}
  </BrowserFrame>
  ```

  `bar` renders a strip between the links and the page, for what the layout itself shows.
-->
<script lang="ts" generics="Page extends string">
  import type { Snippet } from "svelte";

  interface Props {
    /** Shown between the page links and the page: the layout's own content. */
    readonly bar?: Snippet;
    readonly children: Snippet;
    /** The current page, one of `pages`. */
    page: Page;
    readonly pages: readonly Page[];
  }

  let { bar, children, page = $bindable(), pages }: Props = $props();
</script>

<div class="frame not-prose">
  <div class="chrome">
    <span aria-hidden="true" class="dots"><span></span><span></span><span></span></span>
    <span class="address" data-testid="frame-address">example.app/{page}</span>
  </div>
  <nav aria-label="Pages" class="links">
    {#each pages as name (name)}
      <button
        aria-current={page === name ? "page" : undefined}
        class="link"
        onclick={() => (page = name)}
        type="button"
      >
        {name[0]?.toUpperCase()}{name.slice(1)}
      </button>
    {/each}
  </nav>
  {#if bar}<div class="bar">{@render bar()}</div>{/if}
  <div class="page">{@render children()}</div>
</div>

<style>
  .frame {
    background: var(--background);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }
  .chrome {
    align-items: center;
    background: var(--muted);
    display: flex;
    gap: 0.75rem;
    padding: 0.45rem 0.75rem;
  }
  .dots {
    display: flex;
    gap: 0.3rem;
  }
  .dots span {
    background: var(--border-strong);
    border-radius: 999px;
    height: 0.6rem;
    width: 0.6rem;
  }
  .address {
    background: var(--background);
    border-radius: var(--radius-md);
    color: var(--muted-foreground);
    flex: 1;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    min-width: 0;
    overflow: hidden;
    padding: 0.2rem 0.6rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .links {
    border-bottom: 1px solid var(--border);
    display: flex;
    gap: 0.25rem;
    padding: 0 0.5rem;
  }
  /* Page links, not buttons: override the example's button look. */
  .frame .link {
    background: transparent;
    border: 0;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    color: var(--muted-foreground);
    height: auto;
    margin: 0;
    padding: 0.55rem 0.6rem;
  }
  .frame .link:hover {
    background: transparent;
    color: var(--foreground);
  }
  .frame .link[aria-current="page"] {
    border-bottom-color: var(--brand);
    color: var(--foreground);
  }
  .bar {
    align-items: center;
    background: color-mix(in oklab, var(--muted) 50%, transparent);
    border-bottom: 1px solid var(--border);
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0.4rem 0.75rem;
  }
  .page {
    min-height: 11rem;
    padding: 0.9rem;
  }
</style>
