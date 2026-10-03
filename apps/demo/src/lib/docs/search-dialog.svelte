<script lang="ts">
  import FileTextIcon from "@lucide/svelte/icons/file-text";
  import SearchIcon from "@lucide/svelte/icons/search";
  import { goto } from "$app/navigation";
  import * as Command from "#lib/components/ui/command/index.ts";
  import { Kbd } from "#lib/components/ui/kbd/index.ts";
  import { pages } from "#lib/docs/nav.ts";
  import { loadPagefind, routeUrl } from "#lib/docs/search.ts";
  import type { PagefindResultData } from "#lib/docs/search.ts";

  let open = $state(false);
  let query = $state("");
  let results = $state<readonly PagefindResultData[]>([]);
  // `undefined` until Pagefind has loaded or failed to.
  let available = $state<boolean>();

  // The server can't know the platform, so it renders Ctrl and Macs switch to ⌘ after hydration.
  let shortcut = $state("Ctrl K");
  $effect(() => {
    if (/Mac|iPhone|iPad/u.test(navigator.userAgent)) {
      shortcut = "⌘K";
    }
  });

  const term = $derived(query.trim());
  const matchingPages = $derived(
    pages.filter((page) => page.title.toLowerCase().includes(term.toLowerCase()))
  );

  $effect(() => {
    if (!open) {
      return;
    }
    const current = term;
    void (async () => {
      const pagefind = await loadPagefind();
      available = pagefind !== undefined;
      if (!pagefind || current === "") {
        results = [];
        return;
      }
      const search = await pagefind.debouncedSearch(current);
      if (search && current === term) {
        results = await Promise.all(search.results.slice(0, 8).map((result) => result.data()));
      }
    })();
  });

  const onkeydown = (event: KeyboardEvent) => {
    if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      open = !open;
    }
  };

  const select = (url: string) => {
    open = false;
    query = "";
    void goto(url);
  };
</script>

<svelte:window {onkeydown} />

<button
  aria-label="Search"
  class="inline-flex h-8 w-full items-center gap-2 rounded-md border border-input bg-background px-2.5 text-sm text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground md:w-56"
  onclick={() => (open = true)}
  type="button"
>
  <SearchIcon class="size-4" />
  <span class="flex-1 text-left">Search</span>
  <Kbd class="hidden sm:inline-flex">{shortcut}</Kbd>
</button>

<Command.Dialog bind:open description="Search the docs" shouldFilter={false} title="Search">
  <Command.Input bind:value={query} placeholder="Search the docs" />
  <Command.List>
    {#if term === "" || available === false}
      {#if available === false && term !== ""}
        <p class="px-3 pt-3 text-xs text-muted-foreground">
          Full-text search needs a build (<code>vite build</code>); matching page titles only.
        </p>
      {/if}
      <Command.Empty>No pages found.</Command.Empty>
      <Command.Group heading="Pages">
        {#each matchingPages as page (page.href)}
          <Command.Item onSelect={() => select(page.href)} value={page.href}>
            <FileTextIcon />
            {page.title}
          </Command.Item>
        {/each}
      </Command.Group>
    {:else}
      <Command.Empty>No results for “{term}”.</Command.Empty>
      {#each results as result (result.url)}
        <Command.Group heading={result.meta.title ?? routeUrl(result.url)}>
          <Command.Item onSelect={() => select(routeUrl(result.url))} value={result.url}>
            <!-- Pagefind's excerpts are escaped page text with the matches wrapped in <mark>. -->
            <span class="search-excerpt line-clamp-2">{@html result.excerpt}</span>
          </Command.Item>
          {#each result.sub_results.filter((sub) => sub.url !== result.url).slice(0, 3) as sub (sub.url)}
            <Command.Item onSelect={() => select(routeUrl(sub.url))} value={sub.url}>
              <span class="flex flex-col gap-0.5">
                <span class="font-medium">{sub.title}</span>
                <span class="search-excerpt line-clamp-1 text-muted-foreground">{@html sub.excerpt}</span>
              </span>
            </Command.Item>
          {/each}
        </Command.Group>
      {/each}
    {/if}
  </Command.List>
</Command.Dialog>

<style>
  .search-excerpt :global(mark) {
    background: transparent;
    color: var(--brand);
    font-weight: 600;
  }
</style>
