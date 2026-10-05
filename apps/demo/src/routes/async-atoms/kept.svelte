<script module lang="ts">
  import { Atom } from "effect/reactivity";

  import { request } from "./kept-requests.svelte.ts";

  // Pretend requests that take a moment. Each counts its runs for the cards
  // under the pages.
  const loadWeather = request("weather", "18 °C, light rain");
  const loadSettings = request("settings", "Dark theme");
  const search = request("search", "3 results for “atoms”");

  // Fresh on every visit.
  const weatherAtom = Atom.make(loadWeather);
  // Loaded once per session.
  const settingsAtom = Atom.make(loadSettings).pipe(Atom.keepAlive);
  // Kept for 3 seconds after the last reader leaves.
  const searchAtom = Atom.make(search).pipe(Atom.setIdleTTL("3 seconds"));
</script>

<script lang="ts">
  import BrowserFrame from "#lib/docs/kit/browser-frame.svelte";
  import CacheCard from "./cache-card.svelte";
  import { runs } from "./kept-requests.svelte.ts";
  import Reader from "./kept-reader.svelte";

  // The page being shown. Only the dashboard reads the three atoms.
  let page = $state<"dashboard" | "help">("help");
</script>

<BrowserFrame bind:page pages={["dashboard", "help"]}>
  <div data-testid="kept-page">
    {#if page === "dashboard"}
      <Reader atom={weatherAtom} label="Weather" />
      <Reader atom={settingsAtom} label="Settings" />
      <Reader atom={searchAtom} label="Search" />
    {:else}
      <p class="m-0 text-sm">The help page reads none of the three atoms.</p>
    {/if}
  </div>
</BrowserFrame>

<!-- What the registry holds for each atom, and how often its request ran. -->
<div class="mt-4 grid gap-3 sm:grid-cols-3">
  {#each [
    { atom: weatherAtom, name: "weatherAtom", runs: runs.weather },
    { atom: settingsAtom, name: "settingsAtom", runs: runs.settings },
    { atom: searchAtom, name: "searchAtom", runs: runs.search },
  ] as card (card.name)}
    <CacheCard {...card} read={page === "dashboard"} />
  {/each}
</div>
