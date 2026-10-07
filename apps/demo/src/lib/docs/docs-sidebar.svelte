<script lang="ts">
  import { afterNavigate } from "$app/navigation";
  import { page } from "$app/state";
  import * as Sidebar from "#lib/components/ui/sidebar/index.ts";
  import { nav } from "#lib/docs/nav.ts";
  import { tick } from "svelte";

  /** Render only the small screens' sheet, for a page that has no sidebar on wide screens. */
  const { sheetOnly = false }: { sheetOnly?: boolean } = $props();

  const sidebar = Sidebar.useSidebar();
  let scroller = $state<HTMLElement | null>(null);

  // On small screens the sidebar is a sheet; close it once a link has taken the visitor elsewhere.
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

  // On load, after each navigation, and when the sheet opens (which mounts a new scroller).
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

<!-- Below the sticky header on wide screens; a sheet from the left on small ones. -->
{#if sidebar.isMobile || !sheetOnly}
  <Sidebar.Root class={sidebar.isMobile ? undefined : "top-14 h-[calc(100svh-3.5rem)]"}>
    <Sidebar.Content bind:ref={scroller} class="py-4">
      <nav aria-label="Docs">
      {#each nav as section (section.title)}
        <Sidebar.Group>
          <Sidebar.GroupLabel class="text-sm font-semibold text-navigation-heading">
            {section.title}
          </Sidebar.GroupLabel>
          <Sidebar.GroupContent>
            <Sidebar.Menu>
              {#each section.pages as item (item.href)}
                <Sidebar.MenuItem>
                  <Sidebar.MenuButton isActive={page.url.pathname === item.href}>
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
