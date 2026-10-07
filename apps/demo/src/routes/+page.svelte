<script lang="ts">
  import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
  import CheckIcon from "@lucide/svelte/icons/check";
  import { dev } from "$app/env";
  import { Button } from "#lib/components/ui/button/index.ts";
  import Example from "#lib/docs/example.svelte";
  import InstallCommand from "#lib/docs/install-command.svelte";
  import { nav } from "#lib/docs/nav.ts";
  import PageDescription from "#lib/docs/page-description.svelte";
  // Each example twice: the component, and its source from a ?highlight import.
  /* oxlint-disable import/no-duplicates */
  import Report from "#lib/landing/report.svelte";
  import SharedRate from "#lib/landing/shared-rate.svelte";
  import TodoList from "#lib/landing/todo-list.svelte";
  import TodoLookup from "#lib/landing/todo-lookup.svelte";
  // oxlint-disable-next-line import/default -- the linter resolves the .ts file, not the ?highlight import
  import exchangeRateSource from "#lib/landing/exchange-rate.ts?highlight";
  import userBadgeSource from "#lib/landing/hero/user-badge.svelte?highlight";
  // oxlint-disable-next-line import/default -- the linter resolves the .ts file, not the ?highlight import
  import userSource from "#lib/landing/hero/user.ts?highlight";
  import rateSource from "#lib/landing/rate.svelte?highlight";
  import reportSource from "#lib/landing/report.svelte?highlight";
  import sharedRateSource from "#lib/landing/shared-rate.svelte?highlight";
  import todoListSource from "#lib/landing/todo-list.svelte?highlight";
  import todoLookupSource from "#lib/landing/todo-lookup.svelte?highlight";
  /* oxlint-enable import/no-duplicates */
  // oxlint-disable-next-line import/default -- the linter resolves the .ts file, not the ?highlight import
  import rpcSource from "../../../../packages/demo-domain/src/rpc.ts?highlight";

  const repositoryUrl = "https://github.com/jarrednorrisdev/effect-atom-svelte";
  const changelogUrl = `${repositoryUrl}/blob/main/packages/effect-atom-svelte/CHANGELOG.md`;

  /**
   * The hero's table: what Svelte and SvelteKit already cover, and where atoms take over. `fits`
   * marks the side that is the better answer for that need.
   */
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

  /** Which of the hero's two drafts to show: a dev-only switch, until one is picked. */
  let hero = $state<"code" | "table">("code");

  const notNeeded = [
    "State one component owns, such as a form field or an open menu: that is $state.",
    "Apps without Effect: context and remote functions cover shared state well.",
    "An effect that one component runs: Effect.runPromise with getAbortSignal is enough.",
    "Client state with no Effect behind it: a class with $state fields in a root context.",
    "Route data that doesn't change on the page: a load function is enough.",
    "Server data that components only read and refresh: a remote query.",
  ];
</script>

<PageDescription
  description="Svelte 5 bindings for Effect Atom. Share the results of your Effect code across components, typed, cleaned up and refreshed, and talk to an Effect RPC or HttpApi backend."
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
        <span class="text-balance">Write it in Effect.</span><br />
        <span class="text-balance text-brand-text">Read it in any component.</span>
      </h1>
      <p class="mt-6 max-w-xl text-lg text-pretty text-muted-foreground">
        effect-atom-svelte brings Effect Atom to Svelte 5. Share the results of your Effect code
        across components, typed, cleaned up and refreshed, with no context or cache to write for
        each piece. And talk to your Effect backend through typed queries and mutations.
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

    <div class="min-w-0">
      {#if dev}
        <!-- A draft switch, gone from builds: pick one hero, then remove the other. -->
        <div aria-label="Hero draft" class="mb-3 flex gap-2" role="group">
          <Button
            aria-pressed={hero === "code"}
            onclick={() => (hero = "code")}
            size="sm"
            variant={hero === "code" ? "default" : "outline"}
          >
            Code
          </Button>
          <Button
            aria-pressed={hero === "table"}
            onclick={() => (hero = "table")}
            size="sm"
            variant={hero === "table" ? "default" : "outline"}
          >
            Table
          </Button>
        </div>
      {/if}
      {#if hero === "code"}
        <!-- Both files at once: the atom in a module, and a component that reads it. -->
        <div class="hero-code grid gap-3" data-testid="hero-code">
          <Example files={[{ html: userSource, name: "user.ts" }]} />
          <Example cap={30} files={[{ html: userBadgeSource, name: "user-badge.svelte" }]} />
        </div>
      {:else}
        <figure class="min-w-0 overflow-hidden rounded-xl border bg-background shadow-sm">
          <figcaption class="border-b px-5 py-3 text-sm font-semibold">Svelte or atoms?</figcaption>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[32rem] text-left text-sm" data-testid="comparison">
              <thead class="text-xs text-muted-foreground">
                <tr>
                  <th class="w-[30%] px-5 py-2 font-medium" scope="col">You need</th>
                  <th class="px-3 py-2 font-medium" scope="col">Svelte and SvelteKit</th>
                  <th class="px-5 py-2 font-medium text-brand-text" scope="col">Atoms</th>
                </tr>
              </thead>
              <tbody>
                {#each comparison as row (row.need)}
                  <tr class="border-t align-top">
                    <th class="px-5 py-3 font-medium" scope="row">{row.need}</th>
                    {@render cell(row.svelte, row.fits === "svelte", "px-3")}
                    {@render cell(row.atoms, row.fits === "atoms", "px-5")}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </figure>
      {/if}
    </div>
  </div>
</section>

{#snippet cell(text: string, fits: boolean, padding: string)}
  <td class={[padding, "py-3", !fits && "text-muted-foreground"]}>
    {#if fits}
      <span class="inline-flex items-start gap-1.5">
        <CheckIcon class="mt-0.5 size-4 shrink-0 text-brand-text" />
        {text}
      </span>
    {:else}
      {text}
    {/if}
  </td>
{/snippet}

<div class="mx-auto w-full max-w-7xl px-6 lg:px-10">
  <section aria-labelledby="where-atoms-fit" class="pt-20">
    <h2 class="text-3xl font-semibold tracking-tight" id="where-atoms-fit">Where atoms fit</h2>
    <p class="mt-4 max-w-2xl text-lg text-muted-foreground">
      Svelte already handles local state, context and server data. Atoms are for what's left when
      your logic is written in Effect. Each example below runs on this page, and the code under it
      is the file that runs.
    </p>
  </section>

  <section aria-labelledby="shared-effect" class="reason">
    <div class="min-w-0">
      {@render heading("01", "One Effect, shared by every component that reads it", "shared-effect")}
      <p class="mt-4 text-muted-foreground">
        In one component, <code class="font-mono text-[0.9em]">Effect.runPromise</code> is enough.
        Once a second component needs the result, you want one run, shared, and a way to run it
        again for both.
      </p>
      <p class="mt-4 text-muted-foreground">
        An atom gives you that. It's defined once, in a plain module, and any component reads it,
        with no context or cache to write for each one. One provider in your root layout gives each
        request its own values.
      </p>
      {@render links([
        { href: "/why-atoms", title: "Why atoms" },
        { href: "/async-atoms", title: "Async atoms" },
        { href: "/server-rendering", title: "Server rendering" },
      ])}
    </div>
    <div class="min-w-0">
      <Example
        cap={20}
        files={[
          { html: exchangeRateSource, name: "exchange-rate.ts" },
          { html: rateSource, name: "rate.svelte" },
          { html: sharedRateSource, name: "shared-rate.svelte" },
        ]}
        hint="Show the header: the effect runs once. Show the checkout too: it reads the same rate, and the effect doesn't run again. Click Refresh in either: one run updates both."
      >
        <SharedRate />
      </Example>
    </div>
  </section>

  <section aria-labelledby="typed-errors" class="reason">
    <div class="min-w-0">
      {@render heading("02", "Errors you can match on", "typed-errors")}
      <p class="mt-4 text-muted-foreground">
        <code class="font-mono text-[0.9em]">Effect.runPromise</code> and remote functions throw, so
        a component gets an <code class="font-mono text-[0.9em]">unknown</code>. An atom holds an
        <code class="font-mono text-[0.9em]">AsyncResult</code> instead, with the error typed by the
        effect.
      </p>
      <p class="mt-4 text-muted-foreground">
        Here the type comes from the server's RPC schema, so the component matches on
        <code class="font-mono text-[0.9em]">TodoNotFound</code>, and tells it apart from a server it
        couldn't reach.
      </p>
      {@render links([
        { href: "/errors", title: "Errors" },
        { href: "/async-atoms", title: "Async atoms" },
        { href: "/suspense", title: "Suspense" },
      ])}
    </div>
    <div class="min-w-0">
      <Example
        cap={40}
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

  <section aria-labelledby="cleanup" class="reason">
    <div class="min-w-0">
      {@render heading("03", "Interrupted when nothing reads it", "cleanup")}
      <p class="mt-4 text-muted-foreground">
        When the last component reading an atom goes away, its effect is interrupted and its
        finalizers run: a request is cancelled, a stream stops, a socket closes. With one component,
        an <code class="font-mono text-[0.9em]">$effect</code>'s teardown does this. When several
        share the work, the registry counts the readers for you.
      </p>
      <p class="mt-4 text-muted-foreground">
        The trade-off: an atom nothing reads loses its value, unless you keep it alive.
      </p>
      {@render links([
        { href: "/lifetimes", title: "Lifetimes" },
        { href: "/streams", title: "Streams" },
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

  <section aria-labelledby="typed-backend" class="reason">
    <div class="min-w-0">
      {@render heading("04", "Your Effect backend, refreshed by key", "typed-backend")}
      <p class="mt-4 text-muted-foreground">
        If your server speaks Effect RPC or <code class="font-mono text-[0.9em]">HttpApi</code>,
        <code class="font-mono text-[0.9em]">AtomRpc</code> and
        <code class="font-mono text-[0.9em]">AtomHttpApi</code> turn it into atoms for queries and
        mutations, using the server's own schemas, with no fetch layer to write.
      </p>
      <p class="mt-4 text-muted-foreground">
        Tag a query with a key such as <code class="font-mono text-[0.9em]">"todos"</code>. When a
        mutation with the same key succeeds, the query fetches again, and atoms derived from it
        follow. Remote functions can refresh after a mutation too, but each one names the queries it
        affects.
      </p>
      {@render links([
        { href: "/rpc", title: "RPC" },
        { href: "/http", title: "HTTP API" },
        { href: "/mutations", title: "Mutations" },
      ])}
    </div>
    <div class="min-w-0">
      <Example
        cap={42}
        files={[{ html: todoListSource, name: "todo-list.svelte" }]}
        hint={"Add a todo, or click a todo's checkbox: each mutation invalidates \"todos\", todosAtom fetches again, and openCountAtom follows."}
      >
        <TodoList />
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
  .reason :global(.example),
  .hero-code :global(.example) {
    margin: 0;
  }
  @media (width >= 64rem) {
    .reason {
      gap: 4rem;
      grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
    }
  }
</style>
