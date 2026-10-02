<script lang="ts">
  import "../app.css";
  import { preferenceCookiesAtom } from "#lib/preferences.ts";
  import { RegistryProvider } from "effect-atom-svelte";
  import type { Snippet } from "svelte";

  import type { LayoutData } from "./$types";

  const { children, data }: { children: Snippet; data: LayoutData } = $props();

  const pages = [
    ["/", "Overview"],
    ["/basics", "Basics"],
    ["/rpc", "RPC"],
    ["/http", "HTTP API"],
    ["/suspense", "Suspense"],
    ["/mutations", "Mutations"],
    ["/streams", "Streams"],
    ["/refs", "Refs and scopes"],
    ["/browser", "Browser atoms"],
    ["/lifetimes", "Lifetimes"],
  ] as const;
</script>

<!-- One registry per request on the server, one for the session in the browser. The request's
     preference cookies seed the store that cookie-backed atoms read on the server. -->
<RegistryProvider initialValues={[[preferenceCookiesAtom, data.preferenceCookies]]}>
  <nav>
    {#each pages as [href, label] (href)}
      <a {href}>{label}</a>
    {/each}
  </nav>
  <main>
    {@render children()}
  </main>
</RegistryProvider>

<style>
  :global(body) {
    font-family: system-ui, sans-serif;
    margin: 0;
    color: #18181b;
  }
  :global(section) {
    border: 1px solid #e4e4e7;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
    padding: 1rem;
  }
  :global(section h2) {
    font-size: 1rem;
    margin: 0 0 0.25rem;
  }
  :global(section > p:first-of-type) {
    color: #52525b;
    margin-top: 0;
  }
  :global(code, output) {
    background: #f4f4f5;
    border-radius: 0.25rem;
    padding: 0 0.25rem;
  }
  nav {
    background: #18181b;
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    padding: 0.75rem 1.5rem;
  }
  nav a {
    color: #fafafa;
    text-decoration: none;
  }
  main {
    margin: 1.5rem auto;
    max-width: 48rem;
    padding: 0 1.5rem;
  }
</style>
