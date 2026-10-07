<!--
  @component
  The landing page's hero panel, in two tabs: the code (an atom in a module, and a component that
  reads it), and a table of where Svelte is enough and where atoms take over. Code is the default.

  ```svelte
  <HeroPanel />
  ```
-->
<script lang="ts">
  import CheckIcon from "@lucide/svelte/icons/check";
  import * as Tabs from "#lib/components/ui/tabs/index.ts";
  import Example from "#lib/docs/example.svelte";

  import userBadgeSource from "./hero/user-badge.svelte?highlight";
  // oxlint-disable-next-line import/default -- the linter resolves the .ts file, not the ?highlight import
  import userSource from "./hero/user.ts?highlight";

  /** Each need, its answer on either side, and which side is the better answer (`fits`). */
  const comparison: readonly {
    readonly atoms: string;
    readonly fits: "atoms" | "svelte";
    readonly need: string;
    readonly svelte: string;
  }[] = [
    {
      atoms: "Not needed",
      fits: "svelte",
      need: "State one component owns",
      svelte: "$state",
    },
    {
      atoms: "Atoms, when it's derived with Effect state",
      fits: "svelte",
      need: "Client state components share",
      svelte: "A class with $state fields, in a root context",
    },
    {
      atoms: "Atoms, when it comes from Effect code",
      fits: "svelte",
      need: "Server data components read",
      svelte: "A remote query",
    },
    {
      atoms: "One atom, one run, shared",
      fits: "atoms",
      need: "An Effect result several components read",
      svelte: "A run in each, or a cache in context you write",
    },
    {
      atoms: "Typed, as a value you match on",
      fits: "atoms",
      need: "A failure",
      svelte: "Thrown, as unknown",
    },
    {
      atoms: "Interrupted, and finalizers run",
      fits: "atoms",
      need: "Shared work nothing reads any more",
      svelte: "Count the readers yourself",
    },
    {
      atoms: "Keys refetch what changed",
      fits: "atoms",
      need: "After a mutation",
      svelte: "Name each query to refresh",
    },
  ];

  let view = $state("code");
</script>

{#snippet answer(text: string, fits: boolean)}
  {#if fits}
    <span class="inline-flex items-start gap-1.5">
      <CheckIcon aria-label="Better fit" class="mt-0.5 size-4 shrink-0 text-brand-text" />
      {text}
    </span>
  {:else}
    <span class="text-muted-foreground">{text}</span>
  {/if}
{/snippet}

<Tabs.Root bind:value={view} class="min-w-0 gap-3">
  <Tabs.List aria-label="Hero view">
    <Tabs.Trigger class="px-3" value="code">Code</Tabs.Trigger>
    <Tabs.Trigger class="px-3" value="table">Svelte or atoms?</Tabs.Trigger>
  </Tabs.List>

  <Tabs.Content value="code">
    <!-- Both files at once: the atom in a module, and a component that reads it. -->
    <div class="hero-code grid grid-cols-1 gap-3" data-testid="hero-code">
      <Example files={[{ html: userSource, name: "user.ts" }]} />
      <Example cap={30} files={[{ html: userBadgeSource, name: "user-badge.svelte" }]} />
    </div>
  </Tabs.Content>

  <Tabs.Content value="table">
    <div class="overflow-hidden rounded-xl border bg-background shadow-sm" data-testid="comparison">
      <!-- A table where there's room for three columns. -->
      <table class="hidden w-full text-left text-sm sm:table">
        <thead class="text-xs text-muted-foreground">
          <tr>
            <th class="w-[30%] px-5 py-2.5 font-medium" scope="col">You need</th>
            <th class="px-3 py-2.5 font-medium" scope="col">Svelte and SvelteKit</th>
            <th class="px-5 py-2.5 font-medium text-brand-text" scope="col">Atoms</th>
          </tr>
        </thead>
        <tbody>
          {#each comparison as row (row.need)}
            <tr class="border-t align-top">
              <th class="px-5 py-3 font-medium" scope="row">{row.need}</th>
              <td class="px-3 py-3">{@render answer(row.svelte, row.fits === "svelte")}</td>
              <td class="px-5 py-3">{@render answer(row.atoms, row.fits === "atoms")}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      <!-- On a phone, each need as a card with both answers under it. -->
      <dl class="m-0 sm:hidden">
        {#each comparison as row (row.need)}
          <div class="border-t px-4 py-3 text-sm first:border-t-0">
            <dt class="font-medium">{row.need}</dt>
            <dd class="mt-2 ml-0 grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-1.5">
              <span class="text-xs text-muted-foreground">Svelte</span>
              {@render answer(row.svelte, row.fits === "svelte")}
              <span class="text-xs text-brand-text">Atoms</span>
              {@render answer(row.atoms, row.fits === "atoms")}
            </dd>
          </div>
        {/each}
      </dl>
    </div>
  </Tabs.Content>
</Tabs.Root>

<style>
  .hero-code :global(.example) {
    margin: 0;
  }
</style>
