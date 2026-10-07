<!--
  @component
  The landing page's hero panel, in two tabs: a guide to when to reach for atoms in an app with an
  Effect backend (the default), and the code (an atom in a module, and a component that reads it).

  ```svelte
  <HeroPanel />
  ```
-->
<script lang="ts">
  import * as Tabs from "#lib/components/ui/tabs/index.ts";
  import AtomsGuide from "#lib/docs/atoms-guide.svelte";
  import Example from "#lib/docs/example.svelte";

  import userBadgeSource from "./hero/user-badge.svelte?highlight";
  // oxlint-disable-next-line import/default -- the linter resolves the .ts file, not the ?highlight import
  import userSource from "./hero/user.ts?highlight";

  let view = $state("table");
</script>

<Tabs.Root bind:value={view} class="min-w-0 gap-2">
  <Tabs.List aria-label="Hero view">
    <Tabs.Trigger class="px-3" value="table">When to reach for atoms</Tabs.Trigger>
    <Tabs.Trigger class="px-3" value="code">Code</Tabs.Trigger>
  </Tabs.List>

  <div class="hero-views">
  <Tabs.Content data-hero-view value="code">
    <!-- Both files at once: the atom in a module, and a component that reads it. -->
    <div class="hero-code grid grid-cols-1 gap-2" data-testid="hero-code">
      <Example files={[{ html: userSource, name: "user.ts" }]} />
      <Example cap={30} files={[{ html: userBadgeSource, name: "user-badge.svelte" }]} />
    </div>
  </Tabs.Content>

  <Tabs.Content data-hero-view value="table">
    <AtomsGuide />
  </Tabs.Content>
  </div>
</Tabs.Root>

<style>
  .hero-code :global(.example) {
    margin: 0;
  }
  /* Smaller than a docs page's code, so both files fit beside the hero's text. */
  .hero-code :global(.shiki) {
    font-size: 0.78rem;
    line-height: 1.55;
    padding-block: 0.75rem;
  }
  /* On wide screens the panel keeps the code view's height (the taller one), so switching to the
     table doesn't move the hero's text. */
  @media (width >= 64rem) {
    .hero-views {
      min-height: 38rem;
    }
  }
  /* Switching tabs fades the new view in. */
  @media (prefers-reduced-motion: no-preference) {
    :global([data-hero-view]) {
      animation: hero-view-in 0.2s ease-out;
    }
  }
  @keyframes hero-view-in {
    from {
      opacity: 0;
    }
  }
</style>
