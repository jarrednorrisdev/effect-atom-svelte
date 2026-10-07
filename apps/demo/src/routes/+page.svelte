<script lang="ts">
  import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
  import CheckIcon from "@lucide/svelte/icons/check";
  import { Button } from "#lib/components/ui/button/index.ts";
  import Example from "#lib/docs/example.svelte";
  import InstallCommand from "#lib/docs/install-command.svelte";
  import { nav } from "#lib/docs/nav.ts";
  import PageDescription from "#lib/docs/page-description.svelte";
  // Each example twice: the component, and its source from a ?highlight import.
  /* oxlint-disable import/no-duplicates */
  import Report from "#lib/landing/report.svelte";
  import TodoList from "#lib/landing/todo-list.svelte";
  import TodoLookup from "#lib/landing/todo-lookup.svelte";
  import Visitors from "#lib/landing/visitors.svelte";
  import cartSource from "#lib/landing/cart.ts?highlight";
  import reportSource from "#lib/landing/report.svelte?highlight";
  import todoListSource from "#lib/landing/todo-list.svelte?highlight";
  import todoLookupSource from "#lib/landing/todo-lookup.svelte?highlight";
  import visitorSource from "#lib/landing/visitor.svelte?highlight";
  import visitorsSource from "#lib/landing/visitors.svelte?highlight";
  /* oxlint-enable import/no-duplicates */
  // oxlint-disable-next-line import/default -- the linter resolves the .ts file, not the ?highlight import
  import rpcSource from "../../../../packages/demo-domain/src/rpc.ts?highlight";

  const repositoryUrl = "https://github.com/jarrednorrisdev/effect-atom-svelte";
  const changelogUrl = `${repositoryUrl}/blob/main/packages/effect-atom-svelte/CHANGELOG.md`;

  /** The hero's comparison: where runes are enough, and where atoms take over. */
  const comparison = [
    {
      atoms: "Atoms in plain modules; one provider keeps each request apart",
      need: "State components share",
      runes: "A context for each piece, set in a layout",
    },
    {
      atoms: "Derived atoms, in any module",
      need: "State derived from shared state",
      runes: "Derived in a component that reads each context",
    },
    {
      atoms: "AtomRpc and AtomHttpApi, typed errors",
      need: "An Effect backend",
      runes: "A remote function for each procedure; errors arrive thrown",
    },
    {
      atoms: "Keys refetch what changed",
      need: "After a mutation",
      runes: "Name each query to refresh",
    },
  ];

  const notNeeded = [
    "State one component owns, such as a form field or an open menu: that is $state.",
    "Apps without Effect: context and remote functions cover shared state well.",
    "Route data that doesn't change on the page: a load function is enough.",
  ];
</script>

<PageDescription
  description="Svelte 5 bindings for Effect Atom. Keep $state for local state, and use atoms for shared state defined in plain modules, a typed Effect RPC or HttpApi backend, and refetching by key."
/>

{#snippet links(items: readonly { readonly href: string; readonly title: string }[])}
  <p class="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
    {#each items as item (item.href)}
      <a
        class="inline-flex items-center gap-1 font-medium text-brand-text hover:underline hover:underline-offset-4"
        href={item.href}
      >
        {item.title} <ArrowRightIcon class="size-3.5" />
      </a>
    {/each}
  </p>
{/snippet}

{#snippet heading(number: string, title: string, id: string)}
  <p class="font-mono text-sm text-brand-text">{number}</p>
  <h3 class="mt-2 text-2xl font-semibold tracking-tight text-balance" {id}>{title}</h3>
{/snippet}

<section class="hero relative overflow-hidden border-b">
  <div
    class="mx-auto grid w-full max-w-7xl items-center gap-12 px-6 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:px-10 lg:py-24"
  >
    <div class="min-w-0">
      <p
        class="mb-6 inline-flex flex-wrap items-center gap-x-2 rounded-full border bg-background/70 px-3 py-1 text-xs text-muted-foreground backdrop-blur"
      >
        <span class="size-1.5 rounded-full bg-brand"></span>
        Effect Atom for Svelte 5 · community project at 0.x
      </p>
      <h1 class="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-[2.75rem] xl:text-5xl">
        <span class="sm:whitespace-nowrap">Runes for local state.</span><br />
        <span class="text-brand-text sm:whitespace-nowrap">Atoms for the rest.</span>
      </h1>
      <p class="mt-6 max-w-xl text-lg text-pretty text-muted-foreground">
        effect-atom-svelte brings Effect Atom to Svelte 5, for the state your components share and
        the Effect backend they talk to: typed queries and mutations, refetching by key, and shared
        state defined in plain modules, kept apart for each request by one provider.
      </p>
      <div class="mt-8 flex flex-wrap gap-3">
        <Button class="px-4" href="/introduction" size="lg">
          Get started <ArrowRightIcon />
        </Button>
        <Button class="px-4" href="/why-atoms" size="lg" variant="outline">Why atoms</Button>
      </div>
      <div class="mt-8 max-w-xl">
        <InstallCommand />
      </div>
    </div>

    <figure class="min-w-0 overflow-hidden rounded-xl border bg-background shadow-sm">
      <figcaption class="border-b px-5 py-3 text-sm font-semibold">Runes or atoms?</figcaption>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[30rem] text-left text-sm" data-testid="comparison">
          <thead class="text-xs text-muted-foreground">
            <tr>
              <th class="w-[30%] px-5 py-2 font-medium" scope="col">You need</th>
              <th class="px-3 py-2 font-medium" scope="col">Runes and context</th>
              <th class="px-5 py-2 font-medium text-brand-text" scope="col">Atoms</th>
            </tr>
          </thead>
          <tbody>
            <tr class="border-t align-top">
              <th class="px-5 py-3 font-medium" scope="row">State one component owns</th>
              <td class="px-3 py-3">
                <span class="inline-flex items-start gap-1.5">
                  <CheckIcon class="mt-0.5 size-4 shrink-0 text-brand-text" />
                  <span><code class="font-mono text-[0.9em]">$state</code>: use this</span>
                </span>
              </td>
              <td class="px-5 py-3 text-muted-foreground">Not needed</td>
            </tr>
            {#each comparison as row (row.need)}
              <tr class="border-t align-top">
                <th class="px-5 py-3 font-medium" scope="row">{row.need}</th>
                <td class="px-3 py-3 text-muted-foreground">{row.runes}</td>
                <td class="px-5 py-3">
                  <span class="inline-flex items-start gap-1.5">
                    <CheckIcon class="mt-0.5 size-4 shrink-0 text-brand-text" />
                    {row.atoms}
                  </span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </figure>
  </div>
</section>

<div class="mx-auto w-full max-w-7xl px-6 lg:px-10">
  <section aria-labelledby="why-not-state" class="pt-20">
    <h2 class="text-3xl font-semibold tracking-tight" id="why-not-state">
      Why not just <code class="font-mono">$state</code>?
    </h2>
    <p class="mt-4 max-w-2xl text-lg text-muted-foreground">
      For state one component owns, atoms aren't better: use
      <code class="font-mono text-[0.9em]">$state</code>. They earn their place in four other
      places. Each example below runs on this page, and the code under it is the file that runs.
    </p>
  </section>

  <section aria-labelledby="typed-backend" class="reason">
    <div class="min-w-0">
      {@render heading("01", "Your Effect backend, as typed atoms", "typed-backend")}
      <p class="mt-4 text-muted-foreground">
        If your server speaks Effect RPC or <code class="font-mono text-[0.9em]">HttpApi</code>,
        <code class="font-mono text-[0.9em]">AtomRpc</code> and
        <code class="font-mono text-[0.9em]">AtomHttpApi</code> turn it into atoms for queries and
        mutations, with no fetch layer to write.
      </p>
      <p class="mt-4 text-muted-foreground">
        They use the server's own schemas, so results and errors are typed end to end. A component
        matches on <code class="font-mono text-[0.9em]">TodoNotFound</code> instead of catching whatever
        was thrown.
      </p>
      {@render links([
        { href: "/rpc", title: "RPC" },
        { href: "/http", title: "HTTP API" },
        { href: "/errors", title: "Errors" },
      ])}
    </div>
    <div class="min-w-0">
      <Example
        cap={22}
        files={[
          { html: todoLookupSource, name: "todo-lookup.svelte" },
          { html: rpcSource, name: "rpc.ts" },
        ]}
        hint="Pick Todo 99: the server fails with its typed TodoNotFound, and the component matches on it."
      >
        <TodoLookup />
      </Example>
    </div>
  </section>

  <section aria-labelledby="refetch-by-key" class="reason">
    <div class="min-w-0">
      {@render heading("02", "Mutations refresh what they change", "refetch-by-key")}
      <p class="mt-4 text-muted-foreground">
        Tag a query with a key such as <code class="font-mono text-[0.9em]">"todos"</code>. When a
        mutation with the same key succeeds, every atom reading that query fetches again, and atoms
        derived from it follow. There is no refresh to call.
      </p>
      {@render links([
        { href: "/mutations", title: "Mutations" },
        { href: "/derived-atoms", title: "Derived atoms" },
      ])}
    </div>
    <div class="min-w-0">
      <Example
        cap={22}
        files={[{ html: todoListSource, name: "todo-list.svelte" }]}
        hint={'Add a todo, or tick one off: each mutation invalidates "todos", todosAtom fetches again, and openCountAtom follows.'}
      >
        <TodoList />
      </Example>
    </div>
  </section>

  <section aria-labelledby="shared-state" class="reason">
    <div class="min-w-0">
      {@render heading("03", "Shared state in plain modules", "shared-state")}
      <p class="mt-4 text-muted-foreground">
        Svelte keeps shared state apart for each request with context: each piece is set in a
        layout, and read while a component is set up. That works, and it adds up as shared state
        grows.
      </p>
      <p class="mt-4 text-muted-foreground">
        An atom is defined in a plain module and imported where it's needed, and derived atoms
        read other atoms from any module. Values live in a registry, and one provider in your root
        layout gives each request its own, for every atom. Results awaited on the server are sent
        with the page, so the browser doesn't fetch them again.
      </p>
      {@render links([
        { href: "/why-atoms", title: "Why atoms" },
        { href: "/server-rendering", title: "Server rendering" },
        { href: "/hydration", title: "Hydration" },
      ])}
    </div>
    <div class="min-w-0">
      <Example
        cap={22}
        files={[
          { html: cartSource, name: "cart.ts" },
          { html: visitorsSource, name: "visitors.svelte" },
          { html: visitorSource, name: "visitor.svelte" },
        ]}
        hint="Click Add to cart for Ada three times: Ada's freeShippingAtom turns true, and Grace's cart stays at 0."
      >
        <Visitors />
      </Example>
    </div>
  </section>

  <section aria-labelledby="effects" class="reason">
    <div class="min-w-0">
      {@render heading("04", "Any Effect or Stream, awaited in markup", "effects")}
      <p class="mt-4 text-muted-foreground">
        Put an <code class="font-mono text-[0.9em]">Effect</code> or a
        <code class="font-mono text-[0.9em]">Stream</code> in an atom and
        <code class="font-mono text-[0.9em]">await</code> it in markup, with
        <code class="font-mono text-[0.9em]">&lt;svelte:boundary&gt;</code> for loading and failure.
      </p>
      <p class="mt-4 text-muted-foreground">
        When nothing reads the atom any more, its effect is interrupted and its finalizers run.
      </p>
      {@render links([
        { href: "/async-atoms", title: "Async atoms" },
        { href: "/suspense", title: "Suspense" },
        { href: "/streams", title: "Streams" },
        { href: "/lifetimes", title: "Lifetimes" },
      ])}
    </div>
    <div class="min-w-0">
      <Example
        cap={22}
        files={[{ html: reportSource, name: "report.svelte" }]}
        hint="Show the report, then hide it before three seconds pass: nothing reads reportAtom, so its effect is interrupted."
      >
        <Report />
      </Example>
    </div>
  </section>

  <section
    aria-labelledby="get-started"
    class="mt-20 grid gap-10 rounded-2xl border bg-card p-8 md:grid-cols-2 md:p-10"
  >
    <div class="min-w-0">
      <h2 class="text-2xl font-semibold tracking-tight" id="get-started">Get started</h2>
      <p class="mt-3 text-muted-foreground">
        Install the package, turn on Svelte's async mode and put one provider in your root layout.
        If you have used <code class="font-mono text-[0.9em]">@effect/atom-react</code>, you already
        know the atoms; only the hooks change.
      </p>
      <div class="mt-6 flex flex-wrap gap-3">
        <Button class="px-4" href="/installation">Installation <ArrowRightIcon /></Button>
        <Button class="px-4" href="/first-atom" variant="outline">Your first atom</Button>
        <Button class="px-4" href="/migrating-from-react" variant="ghost">
          Coming from React
        </Button>
      </div>
    </div>
    <div class="min-w-0">
      <h2 class="text-2xl font-semibold tracking-tight" id="not-needed">
        When you don't need atoms
      </h2>
      <ul class="mt-3 grid gap-2 text-muted-foreground">
        {#each notNeeded as item (item)}
          <li class="flex gap-2">
            <span
              aria-hidden="true"
              class="mt-2.5 size-1.5 shrink-0 rounded-full bg-subtle-foreground"
            ></span>
            {item}
          </li>
        {/each}
      </ul>
      {@render links([{ href: "/why-atoms", title: "Why atoms: the trade-offs" }])}
    </div>
  </section>

  <nav
    aria-label="All pages"
    class="mt-20 grid grid-cols-2 gap-x-8 gap-y-8 border-t pt-12 sm:grid-cols-3 lg:grid-cols-7"
  >
    {#each nav as section (section.title)}
      <div>
        <h2 class="text-sm font-semibold text-navigation-heading">{section.title}</h2>
        <ul class="mt-3 space-y-2 text-sm">
          {#each section.pages as item (item.href)}
            <li>
              <a class="text-muted-foreground hover:text-brand-text" href={item.href}>{item.title}</a>
            </li>
          {/each}
        </ul>
      </div>
    {/each}
  </nav>

  <footer class="mt-12 border-t py-10 text-sm text-muted-foreground">
    <p class="max-w-3xl">
      effect-atom-svelte is a community project by
      <a class="underline underline-offset-4" href="https://github.com/jarrednorrisdev">Jarred Norris</a
      >, MIT licensed. It is not part of Effect and is not made or endorsed by the Effect team. It is
      at 0.x, so a minor release can change its API: see the
      <a class="underline underline-offset-4" href={changelogUrl}>changelog</a>.
      The docs are also Markdown, for AI assistants:
      <a class="underline underline-offset-4" href="/llms.txt">llms.txt</a>.
    </p>
  </footer>
</div>

<style>
  /* A faint grid fading out from the top, tinted with the accent behind the heading. */
  .hero {
    background:
      radial-gradient(
        60rem 30rem at 20% -10%,
        color-mix(in oklab, var(--brand) 14%, transparent),
        transparent 70%
      ),
      var(--background);
  }
  .hero::before {
    background-image:
      linear-gradient(to right, var(--border) 1px, transparent 1px),
      linear-gradient(to bottom, var(--border) 1px, transparent 1px);
    background-size: 3rem 3rem;
    content: "";
    inset: 0;
    mask-image: radial-gradient(ellipse 80% 70% at 30% 0%, black, transparent 75%);
    opacity: 0.6;
    pointer-events: none;
    position: absolute;
  }
  .hero > * {
    position: relative;
  }
  /* A reason: its explanation beside its live example on wide screens, above it on narrow ones. */
  .reason {
    align-items: start;
    border-top: 1px solid var(--border);
    display: grid;
    gap: 2rem;
    margin-top: 3rem;
    padding-top: 3rem;
  }
  .reason :global(.example) {
    margin: 0;
  }
  @media (width >= 64rem) {
    .reason {
      gap: 4rem;
      grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
    }
  }
</style>
