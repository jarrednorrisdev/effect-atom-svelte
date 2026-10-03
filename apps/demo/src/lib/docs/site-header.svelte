<script lang="ts">
  import { Button } from "#lib/components/ui/button/index.ts";
  import * as Sidebar from "#lib/components/ui/sidebar/index.ts";

  import SearchDialog from "./search-dialog.svelte";
  import ThemeToggle from "./theme-toggle.svelte";
</script>

<header class="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4 md:px-6">
  <Sidebar.Trigger class="md:hidden" />
  <a class="font-semibold tracking-tight text-foreground" href="/">effect-atom-svelte</a>
  <div class="ml-auto flex items-center gap-1 md:gap-2">
    <SearchDialog />
    <Button
      aria-label="GitHub"
      href="https://github.com/jarrednorrisdev/effect-atom-svelte"
      size="icon-sm"
      variant="ghost"
    >
      <svg aria-hidden="true" class="size-4" fill="currentColor" viewBox="0 0 24 24">
        <path
          d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 0-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6 0-3.2 0 0 1-.3 3.4 1.2a11.5 11.5 0 0 1 6 0C17.3 4.8 18.3 5 18.3 5c.7 1.6.2 2.9.1 3.2.8.8 1.3 1.9 1.3 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3"
        />
      </svg>
    </Button>
    <ThemeToggle />
  </div>
</header>
