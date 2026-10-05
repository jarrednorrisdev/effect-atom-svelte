<script lang="ts">
  import SearchIcon from "@lucide/svelte/icons/search";
  import { Kbd } from "#lib/components/ui/kbd/index.ts";
  import type { Component } from "svelte";

  import { searchShortcut } from "./search-shortcut.svelte.ts";

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

  const shortcut = searchShortcut();

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
  class="inline-flex size-8 shrink-0 items-center justify-center gap-2 rounded-md border border-input bg-background text-sm text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground sm:w-full sm:justify-start sm:px-2.5 md:w-56"
  onclick={() => void show()}
  onfocus={() => void load()}
  onpointerenter={() => void load()}
  type="button"
>
  <SearchIcon class="size-4" />
  <!-- Phones get the icon alone, so the header fits; the button's label stays "Search". -->
  <span class="hidden flex-1 text-left sm:inline">Search</span>
  <Kbd class="hidden sm:inline-flex">{shortcut.current}</Kbd>
</button>

{#if SearchDialog}
  <SearchDialog bind:open />
{/if}
