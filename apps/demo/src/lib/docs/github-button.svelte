<script lang="ts">
  import { Button } from "#lib/components/ui/button/index.ts";
  import * as Tooltip from "#lib/components/ui/tooltip/index.ts";

  /**
   * The header's link to the repository. The repository is private until JND-76, so for now the
   * button goes nowhere and a tooltip says why. The tooltip opens on hover, on keyboard focus and on
   * a tap (touch screens have no hover, and an `aria-disabled` button still gets clicks).
   */

  const repositoryUrl = "https://github.com/jarrednorrisdev/effect-atom-svelte";
  // JND-76: set this to true when the repository is public; the button becomes a plain link.
  const isPublic = false;
  const explanation = "The repository goes public soon";

  let open = $state(false);
</script>

{#snippet githubMark()}
  <!-- Lucide dropped brand icons, so this is GitHub's mark. -->
  <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
    <path
      d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 0-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6 0-3.2 0 0 1-.3 3.4 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8 0 3.2.9.8 1.3 1.9 1.3 3.2 0 4.6-2.8 5.6-5.5 5.9.5.4.9 1.1.9 2.2v3.3c0 .3.1.7.8.6A12 12 0 0 0 12 .3"
    />
  </svg>
{/snippet}

{#if isPublic}
  <Button aria-label="GitHub repository" href={repositoryUrl} size="icon-sm" variant="ghost">
    {@render githubMark()}
  </Button>
{:else}
  <!-- Its own provider, so the button doesn't depend on sitting inside the sidebar's. -->
  <Tooltip.Provider>
    <Tooltip.Root bind:open disableCloseOnTriggerClick>
      <Tooltip.Trigger onclick={() => (open = true)}>
        {#snippet child({ props })}
          <Button
            {...props}
            aria-disabled="true"
            aria-label={`GitHub repository: ${explanation.toLowerCase()}`}
            class="cursor-not-allowed text-muted-foreground opacity-60 hover:bg-transparent hover:text-muted-foreground dark:hover:bg-transparent"
            size="icon-sm"
            variant="ghost"
          >
            {@render githubMark()}
          </Button>
        {/snippet}
      </Tooltip.Trigger>
      <Tooltip.Content role="tooltip" side="bottom" sideOffset={6}>{explanation}</Tooltip.Content>
    </Tooltip.Root>
  </Tooltip.Provider>
{/if}
