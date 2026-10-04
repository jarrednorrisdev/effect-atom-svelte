<script lang="ts">
  import SearchIcon from "@lucide/svelte/icons/search";
  import { Kbd } from "#lib/components/ui/kbd/index.ts";
  import type { Component } from "svelte";

  /**
   * The header's search button and its Ctrl K / ⌘K shortcut. The dialog (a command palette) is most
   * of the search code and few visits open it, so it loads on first use: when the pointer or focus
   * reaches the button, or on the shortcut.
   */

  let open = $state(false);
  let SearchDialog = $state<Component<{ open: boolean }, object, "open">>();
  let loading: Promise<void> | undefined;

  const load = () => {
    loading ??= (async () => {
      const module = await import("./search-dialog.svelte");
      SearchDialog = module.default;
    })();
    return loading;
  };

  const show = async () => {
    await load();
    open = true;
  };

  // The server can't know the platform, so it renders Ctrl and Macs switch to ⌘ after hydration.
  let shortcut = $state("Ctrl K");
  $effect(() => {
    if (/Mac|iPhone|iPad/u.test(navigator.userAgent)) {
      shortcut = "⌘K";
    }
  });

  const onkeydown = (event: KeyboardEvent) => {
    if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      if (open) {
        open = false;
      } else {
        void show();
      }
    }
  };
</script>

<svelte:window {onkeydown} />

<button
  aria-label="Search"
  class="inline-flex h-8 w-full items-center gap-2 rounded-md border border-input bg-background px-2.5 text-sm text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground md:w-56"
  onclick={() => void show()}
  onfocus={() => void load()}
  onpointerenter={() => void load()}
  type="button"
>
  <SearchIcon class="size-4" />
  <span class="flex-1 text-left">Search</span>
  <Kbd class="hidden sm:inline-flex">{shortcut}</Kbd>
</button>

{#if SearchDialog}
  <SearchDialog bind:open />
{/if}
