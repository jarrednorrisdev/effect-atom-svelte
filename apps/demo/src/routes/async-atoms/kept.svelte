<script module lang="ts">
  import { Effect } from "effect";
  import { Atom } from "effect/reactivity";

  // How many times each request below has run, for the cards under the pages.
  const runsAtom = Atom.make({ search: 0, settings: 0, weather: 0 });

  // A request that takes a moment, and counts each time it runs.
  const request = (name: "search" | "settings" | "weather", value: string) =>
    Atom.make((get) =>
      Effect.gen(function* load() {
        get.registry.update(runsAtom, (runs) => ({
          ...runs,
          [name]: runs[name] + 1,
        }));
        yield* Effect.sleep("600 millis");
        return value;
      })
    );

  // Fresh on every visit.
  const weatherAtom = request("weather", "18 °C, light rain");
  // Loaded once per session.
  const settingsAtom = request("settings", "Dark theme").pipe(Atom.keepAlive);
  // Kept for 3 seconds after the last reader leaves.
  const searchAtom = request("search", "3 results for “atoms”").pipe(
    Atom.setIdleTTL("3 seconds")
  );
</script>

<script lang="ts">
  import { useAtomValue } from "effect-atom-svelte";
  import BrowserFrame from "#lib/docs/kit/browser-frame.svelte";
  import CacheCard from "./cache-card.svelte";
  import Reader from "./kept-reader.svelte";

  const runs = useAtomValue(runsAtom);
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
    { atom: weatherAtom, name: "weatherAtom", runs: runs.current.weather },
    { atom: settingsAtom, name: "settingsAtom", runs: runs.current.settings },
    { atom: searchAtom, name: "searchAtom", runs: runs.current.search },
  ] as card (card.name)}
    <CacheCard {...card} read={page === "dashboard"} />
  {/each}
</div>
