<script lang="ts">
  import { page } from "$app/state";
  import * as Sidebar from "#lib/components/ui/sidebar/index.ts";

  import FontToggle from "./font-toggle.svelte";
  import GitHubButton from "./github-button.svelte";
  import ResetDemoApi from "./reset-demo-api.svelte";
  import SearchButton from "./search-button.svelte";
  import SoundToggle from "./sound-toggle.svelte";
  import ThemeToggle from "./theme-toggle.svelte";

  // The pages whose examples call the demo API (#lib/clients.ts). Only they show its reset button.
  const demoApiPages = new Set(["/cookbook", "/http", "/rpc"]);

  // The landing page has no sidebar: its header lines up with the hero's frame instead.
  const landing = $derived(!page.error && page.url.pathname === "/");

  // The frame's middle line only runs through the hero (one screen tall on wide screens), so its
  // cross goes once the hero has scrolled away.
  let scrollY = $state(0);
  let innerHeight = $state(0);
  // innerHeight is 0 on the server, where nothing has scrolled: the cross shows there as it will on
  // load, so hydration finds what the server rendered.
  const pastHero = $derived(innerHeight > 0 && scrollY > innerHeight - 56);
</script>

<svelte:window bind:innerHeight bind:scrollY />

<!--
  The header is ruled like the pages under it: hairlines divide it into cells, and its vertical lines
  carry on the page's own. On the landing page those are the hero frame's sides and middle; on a docs
  page, the sidebar's edge. Each control has a square cell of its own.
-->
<header class="sticky top-0 z-20 h-14 shrink-0 border-b bg-background" class:landing>
  <div class="cells">
    <div class="cell brand">
      <Sidebar.Trigger class="md:hidden" />
      <a class="min-w-0 truncate font-semibold tracking-tight whitespace-nowrap text-foreground" href="/"
        >effect-atom-svelte</a
      >
      {#if landing}
        <span
          class="hidden shrink-0 rounded-full border px-2 py-0.5 text-xs whitespace-nowrap text-muted-foreground xl:inline"
        >
          Community project
        </span>
      {/if}
    </div>
    <!-- A docs page's brand cell is only the sidebar's width, so the badge has a cell of its own. -->
    {#if !landing}
      <div
        class="cell note hidden font-mono text-[0.6875rem] tracking-wider whitespace-nowrap text-muted-foreground uppercase lg:flex"
      >
        Community project
      </div>
    {/if}
    <div class="tools">
      <div class="cell search">
        <SearchButton />
      </div>
      <div class="cell control"><GitHubButton /></div>
      {#if demoApiPages.has(page.url.pathname)}
        <div class="cell control"><ResetDemoApi /></div>
      {/if}
      <div class="cell control"><FontToggle /></div>
      <div class="cell control"><SoundToggle /></div>
      <div class="cell control"><ThemeToggle /></div>
    </div>
    {#if landing}
      <!-- Where the frame's sides and middle meet the header's bottom line. -->
      <i class="cross" style:left="-1px"></i>
      {#if !pastHero}
        <i class="cross hidden lg:block" style:left="50%"></i>
      {/if}
      <i class="cross" style:left="100%"></i>
    {/if}
  </div>
  {#if !landing}
    <!-- Where the sidebar's edge and the table of contents' line (app.css, .docs-column) meet the
         header's bottom line. -->
    <i class="cross sidebar-cross hidden md:block"></i>
    <i class="cross toc-cross hidden xl:block"></i>
  {/if}
</header>

<style>
  header {
    --line: var(--border);
    --cross: color-mix(in oklab, var(--foreground) 55%, transparent);
    position: sticky;
  }
  .cells {
    display: flex;
    height: 100%;
  }
  /* On the landing page the cells sit inside the hero frame's sides (hero-frame.svelte), and split
     at its middle. */
  .landing .cells {
    border-inline: 1px solid var(--line);
    margin: 0 auto;
    max-width: 75rem;
    position: relative;
    width: calc(100% - 3rem);
  }
  .landing .cross {
    top: 100%;
  }
  @media (width >= 64rem) {
    .landing .cells {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      width: calc(100% - 5rem);
    }
    /* The frame draws its middle as the right column's left edge; so does the header. */
    .landing .tools {
      border-left: 1px solid var(--line);
    }
  }
  .cell {
    align-items: center;
    display: flex;
    min-width: 0;
  }
  .brand {
    flex: 1;
    gap: 0.75rem;
    padding-inline: 1rem;
  }
  /* On a docs page below the sidebar's breakpoint the name takes only its own width, and gives way
     first when the screen is too narrow for it and the controls. */
  header:not(.landing) .brand {
    flex: 0 1 auto;
  }
  /* On a docs page the brand's cell is the sidebar's width, and its edge carries the sidebar's. */
  @media (width >= 48rem) {
    header:not(.landing) .brand {
      border-right: 1px solid var(--line);
      flex: none;
      padding-inline: 1.5rem;
      width: var(--sidebar-width);
    }
  }
  @media (width >= 64rem) {
    .landing .brand {
      padding-inline: 1.25rem;
    }
  }
  .note {
    flex: 1 1 0;
    overflow: hidden;
    padding-inline: 1.5rem;
  }
  .tools {
    display: flex;
    justify-content: flex-end;
    min-width: 0;
  }
  /* The controls never shrink: the name gives way instead (it truncates). */
  header:not(.landing) .tools {
    flex: 1 0 auto;
  }
  @media (width < 64rem) {
    .landing .tools {
      flex: none;
    }
  }
  .search {
    border-left: 1px solid var(--line);
    container-type: inline-size;
    flex: 0 1 18rem;
    min-width: 10rem;
    padding-inline: 0.75rem;
  }
  /* The shortcut's hint gives way when the cell is narrow (a page with an extra control, say). */
  @container (width < 11rem) {
    .search :global(kbd) {
      display: none;
    }
  }
  /* In the landing page's right half, the search fills what the controls leave, from the middle. */
  @media (width >= 64rem) {
    .landing .search {
      border-left: 0;
      flex: 1;
      padding-inline: 1.25rem;
    }
  }
  /* The search field becomes the cell: no box of its own, the cell's full height. */
  .search :global(> button) {
    background: transparent;
    border: 0;
    border-radius: 0;
    height: 100%;
    padding-inline: 0;
    width: 100%;
  }
  @media (width < 40rem) {
    .search {
      flex: none;
      justify-content: center;
      min-width: 0;
      width: 3.5rem;
    }
  }
  .control {
    border-left: 1px solid var(--line);
    flex: none;
    justify-content: center;
    width: 3.5rem;
  }
  .control :global(button),
  .control :global(a) {
    border-radius: 0;
    height: 100%;
    width: 100%;
  }
  /* On a phone the cells are narrower, and the header runs to the screen's edges: inset like the
     frame, there would be no room left for the name. */
  @media (width < 40rem) {
    .landing .cells {
      border-inline: 0;
      width: 100%;
    }
    .landing .cross {
      display: none;
    }
    .brand {
      gap: 0.5rem;
      padding-inline: 0.75rem;
    }
    .search,
    .control {
      width: 2.75rem;
    }
    .search {
      padding-inline: 0;
    }
  }
  /* A cross on the 1px square where the sidebar's edge meets the header's bottom line, its arms
     1px borders like the lines (see the hero frame's crosses). */
  .cross {
    height: 1px;
    position: absolute;
    width: 1px;
    z-index: 1;
  }
  .cross::before,
  .cross::after {
    content: "";
    position: absolute;
  }
  .cross::before {
    border-top: 1px solid var(--cross);
    left: -6px;
    top: 0;
    width: 13px;
  }
  .cross::after {
    border-left: 1px solid var(--cross);
    height: 13px;
    left: 0;
    top: -6px;
  }
  .sidebar-cross {
    left: calc(var(--sidebar-width) - 1px);
    top: 100%;
  }
  .toc-cross {
    left: calc(100% - var(--toc-width));
    top: 100%;
  }
  /* Above the table of contents, the search and the controls take exactly its width, so the search's
     left border carries its line. */
  @media (width >= 80rem) {
    header:not(.landing) .tools {
      flex: none;
      margin-left: auto;
      width: var(--toc-width);
    }
    header:not(.landing) .search {
      flex: 1;
      min-width: 0;
    }
  }
</style>
