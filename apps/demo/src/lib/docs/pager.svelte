<script lang="ts">
  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import { page } from "$app/state";
  import { neighbours } from "#lib/docs/nav.ts";

  const links = $derived(neighbours(page.url.pathname));
</script>

{#if links.previous || links.next}
  <nav aria-label="Pages" class="mt-16 grid gap-4 sm:grid-cols-2">
    {#if links.previous}
      <a
        class="group flex flex-col gap-1 rounded-lg border p-4 transition-colors hover:border-border-strong"
        href={links.previous.href}
        rel="prev"
      >
        <span class="flex items-center gap-1 text-sm text-muted-foreground">
          <ChevronLeftIcon class="size-4" /> Previous
        </span>
        <span class="font-medium text-foreground">{links.previous.title}</span>
      </a>
    {/if}
    {#if links.next}
      <a
        class="group flex flex-col items-end gap-1 rounded-lg border p-4 transition-colors hover:border-border-strong sm:col-start-2"
        href={links.next.href}
        rel="next"
      >
        <span class="flex items-center gap-1 text-sm text-muted-foreground">
          Next <ChevronRightIcon class="size-4" />
        </span>
        <span class="font-medium text-foreground">{links.next.title}</span>
      </a>
    {/if}
  </nav>
{/if}
