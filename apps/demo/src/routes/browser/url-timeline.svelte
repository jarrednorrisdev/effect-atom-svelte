<!--
  @component
  Beside the searchParam example: the page's query string as an address bar, and a timeline of
  the atom's changes against the URL's. Every key press changes the atom at once; the URL
  changes once, half a second after the last one. Typing again after a pause starts a fresh
  timeline. Presentation only: it watches `location.search`, which `history.pushState` changes
  without an event.

  ```svelte
  <UrlTimeline name="filter" value={filter.current} />
  ```
-->
<script lang="ts">
  import { untrack } from "svelte";

  import { EventLogState } from "#lib/docs/kit/event-log.svelte.ts";
  import FlashValue from "#lib/docs/kit/flash-value.svelte";
  import Timeline from "#lib/docs/kit/timeline.svelte";

  interface Props {
    /** The search parameter's name. */
    readonly name: string;
    /** The atom's value. */
    readonly value: string;
  }

  const { name, value }: Props = $props();

  /** A change after this long a pause starts a new timeline. */
  const pause = 1500;

  const log = new EventLogState();
  let writes = $state(0);
  let updates = $state(0);
  // Empty on the server, which has no URL to read; filled in once the page has hydrated.
  let search = $state("");
  let lastAt = 0;

  const note = (label: string, lane: string) => {
    const now = performance.now();
    if (now - lastAt > pause) {
      log.clear();
      writes = 0;
      updates = 0;
    }
    lastAt = now;
    log.add(label, { lane, tone: lane === "URL" ? "success" : "running" });
  };

  // Every change of the atom's value, but not the value it starts with.
  let first = true;
  $effect(() => {
    const current = value;
    if (first) {
      first = false;
      return;
    }
    untrack(() => {
      note(`${name} = "${current}"`, "atom");
      writes += 1;
    });
  });

  // pushState fires no event, so check the URL every 50 ms.
  $effect(() => {
    ({ search } = location);
    const timer = setInterval(() => {
      const now = location.search;
      if (now !== search) {
        search = now;
        note(now || "no query string", "URL");
        updates += 1;
      }
    }, 50);
    return () => clearInterval(timer);
  });
</script>

<div class="url-timeline">
  <p class="address">
    <span class="sr-only">Query string:</span>
    <code data-testid="filter-url">{search || "(no query string)"}</code>
  </p>
  <p class="counts">
    <span><FlashValue data-testid="filter-writes" value={writes} /> atom writes</span>
    <span><FlashValue data-testid="filter-updates" value={updates} /> URL updates</span>
  </p>
  <Timeline data-testid="filter-timeline" entries={log.entries} lanes={["atom", "URL"]} />
</div>

<style>
  .url-timeline {
    border-top: 1px dashed var(--border-strong);
    display: grid;
    gap: 0.5rem;
    margin-top: 1rem;
    padding-top: 0.75rem;
  }
  .address {
    border: 1px solid var(--border);
    border-radius: 9999px;
    margin: 0;
    overflow-wrap: anywhere;
    padding: 0.25rem 0.75rem;
  }
  .counts {
    display: flex;
    flex-wrap: wrap;
    font-size: 0.875rem;
    gap: 0.5rem 1.25rem;
    margin: 0;
  }
</style>
