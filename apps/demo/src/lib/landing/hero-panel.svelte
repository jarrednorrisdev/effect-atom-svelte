<!--
  @component
  The landing page's hero panel, in two tabs: the code (an atom in a module, and a component that
  reads it), and a guide to which tool to reach for, Svelte's or atoms, with the chain a mutation
  sets off underneath. Code is the default.

  ```svelte
  <HeroPanel />
  ```
-->
<script lang="ts">
  import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
  import * as Tabs from "#lib/components/ui/tabs/index.ts";
  import Example from "#lib/docs/example.svelte";

  import userBadgeSource from "./hero/user-badge.svelte?highlight";
  // oxlint-disable-next-line import/default -- the linter resolves the .ts file, not the ?highlight import
  import userSource from "./hero/user.ts?highlight";

  /** Each need, the tool to reach for, and why. `atoms` marks the rows where that tool is atoms. */
  const guide: readonly {
    readonly atoms: boolean;
    readonly need: string;
    readonly tool: string;
    readonly why: string;
  }[] = [
    {
      atoms: false,
      need: "State one component owns",
      tool: "$state",
      why: "in that component",
    },
    {
      atoms: false,
      need: "Client state components share",
      tool: "A class with $state fields",
      why: "in a root context",
    },
    {
      atoms: false,
      need: "Server data components read",
      tool: "A remote query",
      why: "shared between components, and refreshed when you ask",
    },
    {
      atoms: true,
      need: "Browser-side Effect code several components read",
      tool: "An atom",
      why: "one run, shared, and interrupted when nothing reads it",
    },
    {
      atoms: true,
      need: "Errors you want to match on",
      tool: "An atom",
      why: "failures typed per procedure, as values",
    },
    {
      atoms: true,
      need: "State that stays in step after a mutation",
      tool: "Atoms with reactivity keys",
      why: "keyed queries refetch, and every atom derived from them follows; remote functions refresh only the queries each mutation lists",
    },
  ];

  /** What one mutation sets off, each step declared once, where its atom is defined. */
  const chain = [
    { name: "createTodo", note: "a mutation" },
    { name: '"todos"', note: "its key" },
    { name: "todosAtom", note: "refetches" },
    { name: "openCountAtom", note: "follows" },
    { name: "Components", note: "re-render" },
  ] as const;

  let view = $state("code");
</script>

<Tabs.Root bind:value={view} class="min-w-0 gap-2">
  <Tabs.List aria-label="Hero view">
    <Tabs.Trigger class="px-3" value="code">Code</Tabs.Trigger>
    <Tabs.Trigger class="px-3" value="table">Which to use?</Tabs.Trigger>
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
      <table class="w-full text-left text-sm">
        <thead class="text-xs text-muted-foreground">
          <tr>
            <th class="w-[38%] px-4 py-2.5 font-medium sm:px-5" scope="col">You need</th>
            <th class="px-4 py-2.5 font-medium sm:px-5" scope="col">Reach for</th>
          </tr>
        </thead>
        <tbody>
          {#each guide as row (row.need)}
            <tr class="border-t align-top">
              <th class="px-4 py-2.5 font-medium sm:px-5" scope="row">{row.need}</th>
              <td class="px-4 py-2.5 sm:px-5">
                <span class={["font-medium", row.atoms && "text-brand-text"]}>{row.tool}</span>:
                <span class="text-muted-foreground">{row.why}</span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <!-- The chain the last row describes. Each step lights up in turn when the tab opens. -->
    <figure class="mt-3 mb-0 rounded-xl border bg-background p-4 shadow-sm" data-testid="chain">
      <ol class="m-0 flex list-none flex-wrap items-start gap-x-1.5 gap-y-3 p-0">
        {#each chain as step, index (step.name)}
          <li class="flex items-start gap-1.5">
            {#if index > 0}
              <ArrowRightIcon aria-hidden="true" class="mt-1.5 size-3.5 shrink-0 text-subtle-foreground" />
            {/if}
            <span class="grid gap-1">
              <code class="chain-step font-mono text-xs" style:--step={index}>{step.name}</code>
              <span class="text-xs text-muted-foreground">{step.note}</span>
            </span>
          </li>
        {/each}
      </ol>
      <figcaption class="mt-3 text-xs text-muted-foreground">
        One mutation, and everything downstream follows. Each link is declared once, where its atom
        is defined; the mutation names only its key.
      </figcaption>
    </figure>
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
  .chain-step {
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 0.2rem 0.45rem;
  }
  /* When the tab opens, the change runs down the chain once: each step lights up in turn. */
  @media (prefers-reduced-motion: no-preference) {
    .chain-step {
      animation: chain-step 0.5s ease-out both;
      animation-delay: calc(0.25s + var(--step) * 0.22s);
    }
  }
  @keyframes chain-step {
    40% {
      background: color-mix(in oklab, var(--tone-running) 22%, transparent);
      border-color: var(--tone-running);
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
