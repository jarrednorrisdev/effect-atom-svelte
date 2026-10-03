<script lang="ts">
  import { afterNavigate } from "$app/navigation";
  import { page } from "$app/state";
  import * as Sidebar from "#lib/components/ui/sidebar/index.ts";
  import { nav } from "#lib/docs/nav.ts";

  const sidebar = Sidebar.useSidebar();

  // On small screens the sidebar is a sheet; close it once a link has taken the visitor elsewhere.
  afterNavigate(() => sidebar.setOpenMobile(false));
</script>

<!-- Below the sticky header on wide screens; a sheet from the left on small ones. -->
<Sidebar.Root class={sidebar.isMobile ? undefined : "top-14 h-[calc(100svh-3.5rem)]"}>
  <Sidebar.Content class="py-4">
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
