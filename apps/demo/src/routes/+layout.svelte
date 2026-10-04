<script lang="ts">
  import "../app.css";
  import { page } from "$app/state";
  import * as Sidebar from "#lib/components/ui/sidebar/index.ts";
  import DocsSidebar from "#lib/docs/docs-sidebar.svelte";
  import { neighbours } from "#lib/docs/nav.ts";
  import Pager from "#lib/docs/pager.svelte";
  import SiteHeader from "#lib/docs/site-header.svelte";
  import { copyCode } from "#lib/docs/copy-code.ts";
  import TocMenu from "#lib/docs/toc-menu.svelte";
  import Toc from "#lib/docs/toc.svelte";
  import { TableOfContents } from "#lib/docs/toc.svelte.ts";
  import { preferenceCookiesAtom } from "#lib/preferences.ts";
  import { RegistryProvider } from "effect-atom-svelte";
  import type { Snippet } from "svelte";

  import type { LayoutData } from "./$types";

  const { children, data }: { children: Snippet; data: LayoutData } = $props();

  const title = $derived(neighbours(page.url.pathname).page?.title);
  let content = $state<HTMLElement>();
  const toc = new TableOfContents(() => content);
</script>

<svelte:document onclick={(event) => void copyCode(event)} />

<svelte:head>
  <title>{title ? `${title} · effect-atom-svelte` : "effect-atom-svelte"}</title>
  <meta
    name="description"
    content="Community-built Svelte 5 bindings for Effect Atom. Not affiliated with Effect or the Effect team."
  />
</svelte:head>

<!-- One registry per request on the server, one for the session in the browser. The request's
     preference cookies seed the store that cookie-backed atoms read on the server. -->
<RegistryProvider initialValues={[[preferenceCookiesAtom, data.preferenceCookies]]}>
  <Sidebar.Provider class="flex-col">
    <a
      class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:ring-2 focus:ring-ring"
      href="#content">Skip to content</a
    >
    <SiteHeader />
    <div class="flex flex-1">
      <DocsSidebar />
      <Sidebar.Inset>
        <div class="mx-auto flex w-full max-w-6xl gap-12 px-6 py-10 lg:px-10">
          <div class="min-w-0 flex-1">
            <TocMenu {toc} />
            <!-- Only this part is indexed for search; the navigation around it is not. -->
            <article bind:this={content} data-pagefind-body id="content">
              {@render children()}
            </article>
            <Pager />
            <footer class="mt-16 border-t pt-6 text-sm text-muted-foreground">
              effect-atom-svelte is a community project by
              <a class="underline underline-offset-4" href="https://github.com/jarrednorrisdev"
                >Jarred Norris</a
              >, MIT licensed. It is not part of Effect and is not made or endorsed by the Effect
              team.
            </footer>
          </div>
          <aside class="hidden w-56 shrink-0 xl:block">
            <div class="sticky top-24">
              {#if toc.entries.length > 0}
                <nav aria-label="On this page" class="text-sm">
                  <h2 class="mb-3 font-semibold text-navigation-heading">On this page</h2>
                  <Toc {toc} />
                </nav>
              {/if}
            </div>
          </aside>
        </div>
      </Sidebar.Inset>
    </div>
  </Sidebar.Provider>
</RegistryProvider>
