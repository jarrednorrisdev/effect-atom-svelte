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
  import Search from "./search.svelte";
  import searchSource from "./search.svelte?highlight";
  import Theme from "./theme.svelte";
  import themeSource from "./theme.svelte?highlight";
</script>

Effect Atom has atoms backed by the browser: storage that survives a reload, the URL's query string, and the tab's visibility. They work the same in Svelte, but a page rendered on the server needs care, because the server has no `localStorage`, no `window` and no idea what the visitor stored. This page shows each of them, and how to render it on the server.

## Persisting to localStorage

`Atom.kvs` keeps an atom's value in a `KeyValueStore`. Back it with `localStorage`, and the value survives a reload:

<Example files={[{ html: draftSource, name: "draft.svelte" }]}> <Draft /> </Example>

`KeyValueStore.layerStorage(() => localStorage)` throws on the server, where `localStorage` doesn't exist. So the example gives the server an in-memory store instead, and the server renders the default value, an empty draft. Once the page hydrates, the browser reads the saved draft and shows it.

<Aside type="caution" title="The first paint shows the default">

The server can't know what a visitor saved in their browser. Reload the page above with a draft saved and you see it appear a moment after the page does. That's fine for a draft, but not for a theme or a language, which must be right on the first paint. Use a cookie for those.

</Aside>

## Preferences in a cookie

A cookie goes to the server with every request, so the server can render the stored value. Back `Atom.kvs` with a store that reads and writes `document.cookie` in the browser, and reads the request's cookies on the server:

<Example files={[{ html: themeSource, name: "theme.svelte" }, { html: preferencesSource, name: "preferences.ts" }]}> <Theme /> </Example>

The server's store needs the request's cookies. Pass them from the root layout's `load` function to the registry, through `initialValues`:

**Example** (Handing the request's cookies to the registry)

```ts
// src/routes/+layout.server.ts
import { preferencePrefix } from "#lib/preferences.ts";

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
<RegistryProvider initialValues={[[preferenceCookiesAtom, data.preferenceCookies]]}>
  {@render children()}
</RegistryProvider>
```

<Aside type="caution" title="initialValues need keepAlive">

The registry disposes of an atom nobody reads, `initialValues` included. Without `Atom.keepAlive`, `preferenceCookiesAtom` could be swept, and its cookies lost, before a component reads a preference.

</Aside>

A page that reads cookies depends on the request, so it can't be prerendered. This site's own theme switch uses `localStorage` and a small inline script instead, because its pages are prerendered.

## The URL's query string

`Atom.searchParam` reads and writes one parameter of the URL's query string. `Atom.debounce` follows another atom, but only once it has stopped changing for a while, which suits a search box:

<Example files={[{ html: searchSource, name: "search.svelte" }]}> <Search /> </Example>

Writes to the URL are batched, and land half a second after the last change, with `history.pushState`. An empty value removes the parameter.

<Aside type="caution" title="The server reads an empty string">

`Atom.searchParam` reads `window.location`, so on the server it is always `""`, whatever the URL. If the server must render the parameter, read it from SvelteKit's `page.url` instead.

</Aside>

## Refreshing when the tab comes back

`Atom.refreshOnWindowFocus` computes an atom again whenever the tab becomes visible, so data that may have changed while the visitor was away is fetched again:

<Example files={[{ html: focusSource, name: "focus.svelte" }]}> <Focus /> </Example>

Switch to another tab and back, and the time changes.

It listens on `window` as soon as it is computed, so on the server it throws. Give it a server value with `Atom.withServerValue`, as the example does. Read with `useAtomValue`, the atom is then never computed on the server. See [Server rendering](/server-rendering#server-values).

<Aside type="tip" title="Stored values that pick an atom">

A stored value that chooses which atom to read, such as a saved filter, must give the same choice on the server and in the browser. A cookie does, and `localStorage` doesn't. See [A getter must pick the same atom](/hydration#a-getter-must-pick-the-same-atom).

</Aside>
