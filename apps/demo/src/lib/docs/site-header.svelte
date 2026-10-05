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
  const demoApiPages = new Set(["/cookbook", "/http", "/mutations", "/rpc"]);
</script>

<header class="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4 md:px-6">
  <Sidebar.Trigger class="md:hidden" />
  <a class="font-semibold tracking-tight whitespace-nowrap text-foreground" href="/">effect-atom-svelte</a>
  <span class="hidden rounded-full border px-2 py-0.5 text-xs text-muted-foreground sm:inline">
    Community project
  </span>
  <div class="ml-auto flex items-center gap-1 md:gap-2">
    <SearchButton />
    <GitHubButton />
    {#if demoApiPages.has(page.url.pathname)}
      <ResetDemoApi />
    {/if}
    <FontToggle />
    <SoundToggle />
    <ThemeToggle />
  </div>
</header>
