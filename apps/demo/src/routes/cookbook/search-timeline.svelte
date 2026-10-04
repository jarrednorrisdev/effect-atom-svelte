<!--
  @component
  The debounced search recipe's timing, beside the example: one dot per key press, per
  debounced value and per search, on a shared time axis, with counters for key presses and
  searches. A search that a newer query replaces before it finishes shows as interrupted. Typing
  again after a pause starts a fresh timeline.

  ```svelte
  <SearchTimeline debounced={debounced.current} query={query.current} result={results.current} />
  ```
-->
<script lang="ts">
  import type { AsyncResult } from "effect/reactivity";
  import { untrack } from "svelte";

  import { EventLogState } from "#lib/docs/kit/event-log.svelte.ts";
  import FlashValue from "#lib/docs/kit/flash-value.svelte";
  import Timeline from "#lib/docs/kit/timeline.svelte";
  import type { Tone } from "#lib/docs/kit/tone.ts";

  interface Props {
    readonly debounced: string;
    readonly query: string;
    readonly result: AsyncResult.AsyncResult<readonly string[], unknown>;
  }

  const { debounced, query, result }: Props = $props();

  /** A key press after this long a pause starts a new timeline. */
  const pause = 1500;

  const log = new EventLogState();
  let keys = $state(0);
  let searches = $state(0);

  // Plain variables, so the effects below rerun only for their own prop.
  let lastAt = 0;
  let searching = false;

  const note = (label: string, lane: string, tone: Tone) => {
    lastAt = performance.now();
    log.add(label, { lane, tone });
  };

  // Runs a callback each time a value changes, but not for the value it starts with.
  const onEachChange = <T,>(read: () => T, react: (value: T) => void) => {
    let first = true;
    $effect(() => {
      const value = read();
      if (first) {
        first = false;
        return;
      }
      untrack(() => react(value));
    });
  };

  onEachChange(
    () => query,
    (value) => {
      if (performance.now() - lastAt > pause && !searching) {
        log.clear();
        keys = 0;
        searches = 0;
      }
      keys += 1;
      note(`typed "${value}"`, "typed", "idle");
    }
  );

  // A new debounced value runs the search again, interrupting one still running.
  onEachChange(
    () => debounced,
    (value) => {
      if (searching) {
        note("search interrupted", "search", "interrupted");
      }
      searching = true;
      searches += 1;
      note(`debounced "${value}"`, "debounced", "running");
      note("search started", "search", "running");
    }
  );

  onEachChange(
    () => result,
    (value) => {
      if (searching && !value.waiting && value._tag !== "Initial") {
        searching = false;
        const found = value._tag === "Success" ? `${value.value.length} found` : "failed";
        note(found, "search", value._tag === "Success" ? "success" : "failure");
      }
    }
  );
</script>

<div class="search-timeline">
  <p class="counts">
    <span><FlashValue data-testid="search-keys" value={keys} /> key presses</span>
    <span><FlashValue data-testid="search-runs" value={searches} /> searches</span>
  </p>
  <Timeline
    data-testid="search-timeline"
    entries={log.entries}
    lanes={["typed", "debounced", "search"]}
  />
</div>

<style>
  .search-timeline {
    border-top: 1px dashed var(--border-strong);
    margin-top: 1rem;
    padding-top: 0.75rem;
  }
  .counts {
    display: flex;
    flex-wrap: wrap;
    font-size: 0.875rem;
    gap: 0.5rem 1.25rem;
    margin: 0;
  }
</style>
