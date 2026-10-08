<script lang="ts">
  import { afterNavigate } from "$app/navigation";
  import { page } from "$app/state";
  import * as Sidebar from "#lib/components/ui/sidebar/index.ts";
  import { nav } from "#lib/docs/nav.ts";
  import { tick } from "svelte";

  /** Render only the small screens' drawer, for a page that has no sidebar on wide screens. */
  const { drawerOnly = false }: { drawerOnly?: boolean } = $props();

  const sidebar = Sidebar.useSidebar();
  let scroller = $state<HTMLElement | null>(null);

  // On small screens the sidebar is a drawer; close it once a link has taken the visitor elsewhere.
  afterNavigate(() => sidebar.setOpenMobile(false));

  /** Scrolls the sidebar (not the page) so the current page's link is in view, if it isn't. */
  const reveal = (container: HTMLElement) => {
    const link = container.querySelector('[aria-current="page"]');
    if (!link) {
      return;
    }
    const box = container.getBoundingClientRect();
    const item = link.getBoundingClientRect();
    if (item.top < box.top || item.bottom > box.bottom) {
      container.scrollTop += item.top - box.top - (box.height - item.height) / 2;
    }
  };

  // On load, after each navigation, and when the drawer opens (which mounts a new scroller).
  $effect(() => {
    const container = scroller;
    // Read so the effect runs again on navigation.
    void page.url.pathname;
    if (container) {
      void (async () => {
        await tick();
        reveal(container);
      })();
    }
  });
</script>

<!-- Below the sticky header on wide screens; a drawer from the bottom on small ones. -->
{#if sidebar.isMobile || !drawerOnly}
  <Sidebar.Root class={sidebar.isMobile ? undefined : "top-14 h-[calc(100svh-3.5rem)]"}>
    <!-- Scrolling past its end doesn't carry on into the page behind it. -->
    <Sidebar.Content bind:ref={scroller} class="overscroll-contain py-0">
      <!-- Ruled like the table of contents: numbered sections between hairlines, each section's
           pages on a line with the current one marked on it in the accent (app.css). -->
      <nav aria-label="Docs">
      {#each nav as section, index (section.title)}
        <Sidebar.Group class="docs-group px-4 py-5">
          <Sidebar.GroupLabel class="docs-label mb-2 h-auto gap-2.5 px-0">
            <span aria-hidden="true" class="text-brand-text tabular-nums"
              >{String(index + 1).padStart(2, "0")}</span
            >
            {section.title}
          </Sidebar.GroupLabel>
          <Sidebar.GroupContent>
            <Sidebar.Menu class="docs-pages gap-0 border-l">
              {#each section.pages as item (item.href)}
                <Sidebar.MenuItem>
                  <Sidebar.MenuButton
                    class="-ml-px h-auto rounded-none border-l border-transparent py-1.5 pl-3 text-navigation-foreground hover:bg-transparent hover:text-foreground active:bg-transparent data-active:border-brand data-active:bg-transparent data-active:font-normal"
                    isActive={page.url.pathname === item.href}
                  >
                    {#snippet child({ props })}
                      <a
                        aria-current={page.url.pathname === item.href ? "page" : undefined}
                        href={item.href}
                        {...props}
                      >
                        {item.title}
                      </a>
                    {/snippet}
                  </Sidebar.MenuButton>
                </Sidebar.MenuItem>
              {/each}
            </Sidebar.Menu>
          </Sidebar.GroupContent>
        </Sidebar.Group>
      {/each}
      </nav>
    </Sidebar.Content>
  </Sidebar.Root>
{/if}
