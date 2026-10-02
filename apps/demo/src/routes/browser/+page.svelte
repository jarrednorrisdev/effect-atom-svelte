<script module lang="ts">
  import { Schema } from "effect";
  import { KeyValueStore } from "effect/persistence";
  import { Atom } from "effect/reactivity";

  const storage = Atom.runtime(KeyValueStore.layerStorage(() => localStorage));

  // localStorage only exists in the browser, so the server renders the default.
  const themeAtom = Atom.kvs({
    defaultValue: () => "light",
    key: "demo-theme",
    runtime: storage,
    schema: Schema.String,
  }).pipe(Atom.withServerValue(() => "light"));

  const queryAtom = Atom.searchParam("q");
  const debouncedAtom = Atom.debounce(queryAtom, "400 millis");
  // refreshOnWindowFocus listens on window when computed, so the server needs a value of its own.
  const focusedAtom = Atom.refreshOnWindowFocus(
    Atom.make(() => new Date().toLocaleTimeString())
  ).pipe(Atom.withServerValue(() => "after hydration"));
</script>

<script lang="ts">
  import { useAtom, useAtomValue } from "effect-atom-svelte";

  const theme = useAtom(themeAtom);
  const query = useAtom(queryAtom);
  const debounced = useAtomValue(debouncedAtom);
  const focused = useAtomValue(focusedAtom);
</script>

<h1>Browser atoms</h1>

<section>
  <h2>Atom.kvs</h2>
  <p>Persisted to <code>localStorage</code> through a <code>KeyValueStore</code>. Reload the page to see it stick.</p>
  <select bind:value={theme.current} data-testid="theme">
    <option value="light">Light</option>
    <option value="dark">Dark</option>
  </select>
  <p>Stored theme: <output>{theme.current}</output></p>
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
