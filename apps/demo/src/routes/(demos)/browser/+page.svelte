<script module lang="ts">
  import { browser } from "$app/env";
  import { cookieStorage } from "#lib/preferences.ts";
  import { Schema } from "effect";
  import { KeyValueStore } from "effect/persistence";
  import { Atom } from "effect/reactivity";

  // localStorage only exists in the browser: the server gets an in-memory store and renders the
  // default, which the browser replaces with the stored value once it hydrates.
  const localStorageRuntime = Atom.runtime(
    browser
      ? KeyValueStore.layerStorage(() => localStorage)
      : KeyValueStore.layerMemory
  );

  const draftAtom = Atom.kvs({
    defaultValue: () => "",
    key: "demo-draft",
    runtime: localStorageRuntime,
    schema: Schema.String,
  });

  // A cookie is sent with every request, so the server renders the stored theme on first paint.
  const themeAtom = Atom.kvs({
    defaultValue: () => "light" as const,
    key: "pref-theme",
    runtime: cookieStorage,
    schema: Schema.Literals(["light", "dark"]),
  });

  const queryAtom = Atom.searchParam("q");
  const debouncedAtom = Atom.debounce(queryAtom, "400 millis");
  // refreshOnWindowFocus listens on window when computed, so the server needs a value of its own
  // until Effect guards it for server rendering.
  const focusedAtom = Atom.refreshOnWindowFocus(
    Atom.make(() => new Date().toLocaleTimeString())
  ).pipe(Atom.withServerValue(() => "after hydration"));
</script>

<script lang="ts">
  import { useAtom, useAtomValue } from "effect-atom-svelte";

  const draft = useAtom(draftAtom);
  const theme = useAtom(themeAtom);
  const query = useAtom(queryAtom);
  const debounced = useAtomValue(debouncedAtom);
  const focused = useAtomValue(focusedAtom);
</script>

<h1>Browser atoms</h1>

<section>
  <h2>Atom.kvs with localStorage</h2>
  <p>
    Persisted to <code>localStorage</code> through a <code>KeyValueStore</code>. The server cannot
    read it, so it renders an empty draft and the saved text appears once the page hydrates.
  </p>
  <textarea bind:value={draft.current} data-testid="draft" placeholder="Type, then reload"></textarea>
  <p>Saved draft: <output data-testid="draft-saved">{draft.current}</output></p>
</section>

<section class="themed" data-testid="themed" data-theme={theme.current}>
  <h2>Atom.kvs with a cookie</h2>
  <p>
    Persisted to a cookie, which the server reads from the request, so a reload paints the stored
    theme straight away.
  </p>
  <select bind:value={theme.current} data-testid="theme">
    <option value="light">Light</option>
    <option value="dark">Dark</option>
  </select>
</section>

<section>
  <h2>Atom.searchParam and Atom.debounce</h2>
  <p>Bound to <code>?q=</code> in the URL. The debounced copy waits 400ms after typing stops.</p>
  <input bind:value={query.current} data-testid="search" placeholder="Search" />
  <p>Now: <output>{query.current}</output></p>
  <p>Debounced: <output data-testid="debounced">{debounced.current}</output></p>
</section>

<section>
  <h2>Atom.refreshOnWindowFocus</h2>
  <p>Recomputed whenever the tab becomes visible again. Switch tabs and come back.</p>
  <p>Last computed: <output>{focused.current}</output></p>
</section>

<style>
  .themed[data-theme="dark"] {
    background: #18181b;
    color: #fafafa;
  }
  .themed[data-theme="dark"] > p:first-of-type {
    color: #a1a1aa;
  }
</style>
