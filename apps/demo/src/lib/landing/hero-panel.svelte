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
  import Example from "#lib/docs/example.svelte";

  import userBadgeSource from "./hero/user-badge.svelte?highlight";
  // oxlint-disable-next-line import/default -- the linter resolves the .ts file, not the ?highlight import
  import userSource from "./hero/user.ts?highlight";

  /**
   * What to reach for in a Svelte app with an Effect backend: runes for a component's own concerns,
   * atoms for the app's state. `atoms` marks the rows where the tool is an atom.
   */
  const guide: readonly {
    readonly atoms: boolean;
    readonly need: string;
    readonly tool: string;
    readonly why: string;
  }[] = [
    {
      atoms: false,
      need: "State one component owns (a draft, an open menu)",
      tool: "$state",
      why: "in that component",
    },
    {
      atoms: false,
      need: "A value computed just for one component's display (a formatted total, a label)",
      tool: "$derived",
      why: "in that component, from its props, state or the atoms it reads",
    },
    {
      atoms: true,
      need: "State shared across components or parts of your app (the signed-in user, a cart, a filter)",
      tool: "An atom in a plain module",
      why: "any component imports it, with no context to set up, and one provider gives each request its own values, so the server renders each visitor's page with their own data",
    },
    {
      atoms: true,
      need: "Data from your Effect backend",
      tool: "A query atom",
      why: "typed by the server's schemas, and shared like any atom",
    },
    {
      atoms: true,
      need: "Writing to your backend (create, update, delete)",
      tool: "A mutation atom with reactivity keys",
      why: "the queries it affects refetch, and everything derived from them follows",
    },
    {
      atoms: true,
      need: "A value computed from other atoms (an open count, a filtered list)",
      tool: "A derived atom",
      why: "it follows whatever it reads, backend data or shared state",
    },
    {
      atoms: true,
      need: "Live data (a feed, a socket)",
      tool: "A stream atom",
      why: "it starts when read, and stops when nothing reads it",
    },
    {
      atoms: true,
      need: "Errors",
      tool: "An atom's result",
      why: "typed per procedure, and matched as values",
    },
  ];


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
    <div class="overflow-hidden rounded-xl border bg-background shadow-sm" data-testid="comparison">
      <table class="w-full text-left text-[0.8125rem] leading-snug">
        <caption class="border-b px-4 py-2.5 text-left text-xs font-medium sm:px-5">
          In a Svelte app with an Effect backend
        </caption>
        <thead class="text-xs text-muted-foreground">
          <tr>
            <th class="w-[40%] px-4 py-2 font-medium sm:px-5" scope="col">You need</th>
            <th class="px-4 py-2 font-medium sm:px-5" scope="col">Reach for</th>
          </tr>
        </thead>
        <tbody>
          {#each guide as row (row.need)}
            <tr class="border-t align-top">
              <th class="px-4 py-2 font-medium sm:px-5" scope="row">{row.need}</th>
              <td class="px-4 py-2 sm:px-5">
                <span class={["font-medium", row.atoms && "text-brand-text"]}>{row.tool}</span>:
                <span class="text-muted-foreground">{row.why}</span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
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
