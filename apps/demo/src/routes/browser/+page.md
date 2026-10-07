---
title: Browser atoms
description: Keep state in localStorage, cookies or the URL, and react to the browser.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import preferencesSource from "#lib/preferences.ts?highlight";
  import Draft from "./draft.svelte";
  import draftSource from "./draft.svelte?highlight";
  import Focus from "./focus.svelte";
  import focusSource from "./focus.svelte?highlight";
  import SearchParam from "./search-param.svelte";
  import searchParamSource from "./search-param.svelte?highlight";
  import Theme from "./theme.svelte";
  import themeSource from "./theme.svelte?highlight";
</script>

Effect Atom has atoms backed by the browser: storage that survives a reload, the URL's query string, and the tab's visibility. They work the same in Svelte, but a page rendered on the server needs care, because the server has no `localStorage`, no `window` and no idea what the visitor stored. This page is a set of recipes, one per kind of atom, each showing how to render it on the server.

The recipes build on [Services and runtimes](/services) for the storage layers, and on [Server rendering](/server-rendering) and [Hydration](/hydration) for what the server sends.

## Persisting to localStorage

`Atom.kvs` keeps an atom's value in a `KeyValueStore`. Back it with `localStorage`, and the value survives a reload:

<Example files={[{ html: draftSource, name: "draft.svelte" }]} hint="Type a draft, then reload the page: it comes back from localStorage. In the HTML shows the server rendered the empty default, so the draft appears just after the page does."> <Draft /> </Example>

`KeyValueStore.layerStorage(() => localStorage)` throws on the server, where `localStorage` doesn't exist. So the example gives the server an in-memory store instead, and the server renders the default value, an empty draft. Once the page has hydrated, the browser reads the saved draft and shows it.

The in-memory store belongs to the registry that builds it, so on the server each request starts with an empty one.

In the browser, the first read finds no value in `localStorage` for a new visitor, so `Atom.kvs` writes the default there.

<Aside type="caution" title="The first paint shows the default">

The server can't know what a visitor saved in their browser. Reload the page above with a draft saved and you see it appear a moment after the page does. That's fine for a draft, but not for a theme or a language, which must be right on the first paint. Use a cookie for those.

</Aside>

## Preferences in a cookie

A cookie goes to the server with every request, so the server can render the stored value. Back `Atom.kvs` with a store that reads and writes `document.cookie` in the browser, and reads the request's cookies on the server:

<Example files={[{ html: themeSource, name: "theme.svelte" }, { html: preferencesSource, name: "preferences.ts" }]} hint="Pick dark, then reload the page. The box is dark from the first paint, and In the HTML says dark: the server read the cookie."> <Theme /> </Example>

The server's store needs the request's cookies. Pass them from the root layout's `load` function to the registry, through `initialValues`:

**Example** (Handing the request's cookies to the registry)

```ts
// src/routes/+layout.server.ts
import { preferencePrefix } from "$lib/preferences.ts";

// Page data is embedded in the HTML, so pass on preference cookies only.
export const load = ({ cookies }) => ({
  preferenceCookies: Object.fromEntries(
    cookies
      .getAll()
      .filter(({ name }) => name.startsWith(preferencePrefix))
      .map(({ name, value }) => [name, value])
  ),
});
```

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { RegistryProvider } from "effect-atom-svelte";

  import { preferenceCookiesAtom } from "$lib/preferences.ts";

  const { children, data } = $props();
</script>

<RegistryProvider initialValues={[[preferenceCookiesAtom, data.preferenceCookies]]}>
  {@render children()}
</RegistryProvider>
```

Like any atom given a value through `initialValues`, `preferenceCookiesAtom` needs `Atom.keepAlive`, or the registry could dispose of it, and its cookies, before a component reads a preference. See [Starting atoms from request data](/sveltekit#starting-atoms-from-request-data).

A page that reads cookies depends on the request, so it can't be prerendered.

A page rendered from cookies differs from one visitor to the next, so keep it out of shared caches: see [Prerender or render per request](/sveltekit#prerender-or-render-per-request).

## The URL's query string

`Atom.searchParam` reads and writes one parameter of the URL's query string. Bind an input to it, and the parameter follows what you type:

<Example files={[{ html: searchParamSource, name: "search-param.svelte" }]} hint="Type a word and watch the timeline: the atom changes on every key, the URL once, half a second after you stop. Then clear the box: the parameter goes away."> <SearchParam /> </Example>

Writes to the URL are batched, and land half a second after the last change, with `history.pushState`, so each pause in typing adds a history entry. An empty value removes the parameter. Going back in the browser's history moves the atom to the URL's value again. The [debounced search](/cookbook#debounced-search) recipe in the Cookbook uses `Atom.searchParam` in a live search box.

<Aside type="caution" title="The server reads an empty string">

`Atom.searchParam` reads `window.location`, so on the server it is always `""`, or `Option.none()` with a schema, whatever the URL. Never make an atom that reads it serializable: the browser would start from the server's result, computed from the empty value. If the server must render the parameter, read it from SvelteKit's `page.url` instead.

</Aside>

<Aside type="caution" title="SvelteKit's router doesn't see the change">

`Atom.searchParam` calls `history.pushState` itself, not through SvelteKit. Its history entries carry none of SvelteKit's own state, so SvelteKit doesn't treat them as navigations: `page.url` can keep the old query string, and `load` functions that read it don't run again. In a SvelteKit app, when anything else reads the parameter, keep it in `page.url` instead: read `page.url.searchParams`, and change it with `goto` from `$app/navigation`. Pass `reset: false` so the focus and scroll position stay where they are, and `replace: true` if a change shouldn't add a history entry.

</Aside>

## Refreshing when the tab comes back

`Atom.refreshOnWindowFocus` computes an atom again whenever the tab becomes visible, so it catches up with anything that changed while the visitor was away:

<Example files={[{ html: focusSource, name: "focus.svelte" }]} hint="Switch to another tab and back: the atom computes again, and the count goes up. In the HTML shows the server value, not yet."> <Focus /> </Example>

It listens on `window` as soon as it is computed, so on the server it throws. Give it a server value with `Atom.withServerValue`, as the example does. The atom is then never computed on the server, whichever hook reads it. See [Server rendering](/server-rendering#server-values).

<Aside type="tip" title="Stored values that pick an atom">

A stored value that chooses which atom to read, such as a saved filter, must give the same choice on the server and in the browser. A cookie does, and `localStorage` doesn't. See [A getter must pick the same atom](/hydration#a-getter-must-pick-the-same-atom).

</Aside>
