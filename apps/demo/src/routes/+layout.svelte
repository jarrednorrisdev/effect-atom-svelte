<script lang="ts">
  import "../app.css";
  import interLatin from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
  import monoLatin from "@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url";
  import { page } from "$app/state";
  import * as Sidebar from "#lib/components/ui/sidebar/index.ts";
  import DocsSidebar from "#lib/docs/docs-sidebar.svelte";
  import { markdownHref, neighbors } from "#lib/docs/nav.ts";
  import { previewImage, siteName, siteUrl } from "#lib/docs/site.ts";
  import Pager from "#lib/docs/pager.svelte";
  import SiteHeader from "#lib/docs/site-header.svelte";
  import { copyCode } from "#lib/docs/copy-code.ts";
  import TocMenu from "#lib/docs/toc-menu.svelte";
  import Toc from "#lib/docs/toc.svelte";
  import { TableOfContents } from "#lib/docs/toc.svelte.ts";
  import { installInTabEventSource } from "#lib/in-tab-api.ts";
  import { preferenceCookiesAtom } from "#lib/preferences.ts";
  import { RegistryProvider } from "effect-atom-svelte";
  import { onMount } from "svelte";
  import type { Snippet } from "svelte";

  import type { LayoutData } from "./$types";

  const { children, data }: { children: Snippet; data: LayoutData } = $props();

  // The hosted build runs the demo API in the tab; examples' EventSource reads from it there.
  installInTabEventSource();

  // Only pages in the sidebar have an address of their own; error pages don't.
  const navTitle = $derived(page.error ? undefined : neighbors(page.url.pathname).page?.title);
  const errorTitle = $derived(
    page.status === 404 ? "Page not found" : "Something went wrong"
  );
  const title = $derived(page.error ? errorTitle : navTitle);
  const fullTitle = $derived(title ? `${title} · ${siteName}` : siteName);
  // The landing page has the whole width: no sidebar, table of contents or pager.
  const landing = $derived(!page.error && page.url.pathname === "/");
  const canonical = $derived(
    navTitle || landing ? `${siteUrl}${page.url.pathname}` : undefined
  );
  let content = $state<HTMLElement>();
  const toc = new TableOfContents(() => content);

  // Marks the page as hydrated, for the e2e tests: input typed before hydration can be lost.
  onMount(() => {
    document.documentElement.dataset.hydrated = "";
  });
</script>

<svelte:document onclick={(event) => void copyCode(event)} />

<svelte:head>
  <!-- Every page uses both fonts; without these, they only start loading once the stylesheet has
       arrived and the page has been laid out. Only the Latin files: app.css's other subsets load
       only for text that needs them. -->
  <link as="font" crossorigin="anonymous" href={interLatin} rel="preload" type="font/woff2" />
  <link as="font" crossorigin="anonymous" href={monoLatin} rel="preload" type="font/woff2" />
  <title>{fullTitle}</title>
  <!-- Each page adds its own description (page-description.svelte), so there is none here. -->
  {#if canonical}
    <link href={canonical} rel="canonical" />
    {#if navTitle}
      <!-- The page as Markdown, for language models (src/lib/docs/llms.ts). The landing page has
           none: it isn't in the sidebar. -->
      <link href="{siteUrl}{markdownHref(page.url.pathname)}" rel="alternate" type="text/markdown" />
    {/if}
    <meta content={canonical} property="og:url" />
  {/if}
  <meta content={fullTitle} property="og:title" />
  <meta content="website" property="og:type" />
  <meta content={siteName} property="og:site_name" />
  <meta content={previewImage.url} property="og:image" />
  <meta content={String(previewImage.width)} property="og:image:width" />
  <meta content={String(previewImage.height)} property="og:image:height" />
  <meta content={previewImage.alt} property="og:image:alt" />
  <meta content="summary_large_image" name="twitter:card" />
  <meta content={fullTitle} name="twitter:title" />
  <meta content={previewImage.url} name="twitter:image" />
  <meta content={previewImage.alt} name="twitter:image:alt" />
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
    {#if landing}
      <!-- The sidebar is only the small screens' sheet here, opened from the header. -->
      <DocsSidebar sheetOnly />
      <main class="min-w-0 flex-1" id="content">
        {@render children()}
      </main>
    {:else}
      <div class="flex flex-1">
        <DocsSidebar />
        <!-- min-w-0: without it, wide code in an example stretches the page past the window. -->
        <Sidebar.Inset class="min-w-0">
          <!-- Ruled like the landing page: the column sits centred between the sidebar's edge and
               the table of contents' line, which keeps to the right edge. Sections, the pager and
               the footer (app.css, .docs-column) rule right across between the two lines, with a
               cross at each end. The site header draws the crosses where those lines meet it. -->
          <div class="flex w-full">
            <div class="docs-area min-w-0 flex-1">
            <div class="docs-column relative mx-auto min-w-0 px-6 pt-10 lg:px-10">
              <TocMenu {toc} />
              <!-- Only this part is indexed for search; the navigation around it is not. -->
              <article bind:this={content} data-pagefind-body id="content">
                {@render children()}
              </article>
              <Pager />
              <!-- Right under the pager: its top line is the pager's bottom one. -->
              <footer class="docs-footer relative border-t py-8 text-sm text-muted-foreground">
                <i class="rule-cross rule-start"></i>
                <i class="rule-cross rule-end"></i>
                effect-atom-svelte is a community project by
                <a class="underline underline-offset-4" href="https://github.com/jarrednorrisdev"
                  >Jarred Norris</a
                >, MIT licensed. It is not part of Effect and is not made or endorsed by the Effect
                team. The docs are also Markdown, for AI assistants:
                <a class="underline underline-offset-4" href="/llms.txt">llms.txt</a>.
              </footer>
            </div>
            </div>
            <aside class="docs-toc hidden shrink-0 xl:block">
              <div class="sticky top-14 px-8 pt-10">
                {#if toc.entries.length > 0}
                  <nav aria-label="On this page" class="text-sm">
                    <h2 class="docs-label mb-4">On this page</h2>
                    <Toc {toc} />
                  </nav>
                {/if}
              </div>
            </aside>
          </div>
        </Sidebar.Inset>
      </div>
    {/if}
  </Sidebar.Provider>
  <!-- The atom devtools, in development only: the import is left out of builds. -->
  {#if import.meta.env.DEV}
    {#await import("effect-atom-svelte-devtools") then { AtomDevtools }}
      <AtomDevtools />
    {/await}
  {/if}
</RegistryProvider>
