<!--
  Every computation, update, interruption and finalizer, newest first, with why each computation
  ran: to answer "why did this refetch?" and "why was this interrupted?".
-->
<script lang="ts">
  import type { Model, TimelineEntry } from "./model.svelte.ts";

  interface Props {
    readonly model: Model;
    readonly showPlumbing: boolean;
    readonly onselect: (id: number) => void;
  }

  const { model, showPlumbing, onselect }: Props = $props();

  type Kind = "computed" | "updated" | "interrupted" | "finalized" | "readers" | "added";
  const kinds: Record<TimelineEntry["tag"], Kind> = {
    Built: "computed",
    Finalized: "finalized",
    Interrupted: "interrupted",
    NodeAdded: "added",
    NodeRemoved: "added",
    ReadersChanged: "readers",
    Updated: "updated",
  };
  const labels: Record<Kind, string> = {
    added: "added, removed",
    computed: "computed",
    finalized: "finalized",
    interrupted: "interrupted",
    readers: "readers",
    updated: "updated",
  };
  const verbs: Record<TimelineEntry["tag"], string> = {
    Built: "computed",
    Finalized: "finalized",
    Interrupted: "interrupted",
    NodeAdded: "added",
    NodeRemoved: "removed",
    ReadersChanged: "readers",
    Updated: "updated",
  };

  let shownKinds = $state<Record<Kind, boolean>>({
    added: true,
    computed: true,
    finalized: true,
    interrupted: true,
    readers: false,
    updated: true,
  });
  let search = $state("");
  // An atom picked from the list: its rows only.
  let only = $state<number>();

  const byId = $derived(new Map(model.atoms.map((view) => [view.id, view])));
  const nameOf = (id: number) => byId.get(id)?.name ?? `atom #${id}`;
  const shownRows = 400;
  const rows = $derived.by(() => {
    const query = search.trim().toLowerCase();
    const matching: TimelineEntry[] = [];
    for (let index = model.timeline.length - 1; index >= 0 && matching.length < shownRows; index -= 1) {
      const entry = model.timeline[index];
      if (entry === undefined || !shownKinds[kinds[entry.tag]]) {
        continue;
      }
      if (only !== undefined && entry.atom !== only && !entry.related.includes(only)) {
        continue;
      }
      if (!showPlumbing && byId.get(entry.atom)?.plumbing && only === undefined) {
        continue;
      }
      if (query !== "" && !nameOf(entry.atom).toLowerCase().includes(query)) {
        continue;
      }
      matching.push(entry);
    }
    return matching;
  });

  const start = $derived(model.timeline[0]?.time ?? 0);
  const time = (entry: TimelineEntry) => `+${((entry.time - start) / 1000).toFixed(3)}`;
</script>

<div class="timeline">
  <div class="toolbar">
    <input aria-label="Filter by atom name" bind:value={search} placeholder="atom name" type="search" />
    {#each Object.keys(labels) as Kind[] as kind (kind)}
      <label class="kind">
        <input bind:checked={shownKinds[kind]} type="checkbox" />
        {labels[kind]}
      </label>
    {/each}
    <span class="spacer"></span>
    {#if only !== undefined}
      <button class="tool" onclick={() => (only = undefined)} type="button">
        only {nameOf(only)} ✕
      </button>
    {/if}
    <button class="tool" aria-pressed={model.paused} onclick={() => (model.paused = !model.paused)} type="button">
      {model.paused ? "resume" : "pause"}
    </button>
    <button class="tool" onclick={() => model.clearTimeline()} type="button">clear</button>
  </div>

  {#if rows.length === 0}
    <p class="empty">Nothing yet. Use the page: every computation and update lands here.</p>
  {:else}
    <ol class="rows">
      {#each rows as entry (entry.seq)}
        <li class="row {kinds[entry.tag]}" class:alert={entry.tag === "Interrupted"}>
          <span class="when">{time(entry)}</span>
          <span class="what">{verbs[entry.tag]}</span>
          <button class="atom" class:plumbing={byId.get(entry.atom)?.plumbing} onclick={() => (only = entry.atom)} ondblclick={() => onselect(entry.atom)} title="Click: only this atom's rows. Double-click: its sheet." type="button">
            {nameOf(entry.atom)}
          </button>
          <span class="detail">
            {#if entry.tag === "Built" && entry.related.length > 0}
              because
              {#each entry.related as id, index (id)}{#if index > 0},{/if}
                <button class="atom inline" onclick={() => (only = id)} type="button">{nameOf(id)}</button>{/each}
              changed
            {:else if entry.tag === "Built"}
              {entry.detail === "first read" ? "first read" : `because it was ${entry.detail}`}
            {:else}
              {entry.detail}
            {/if}
            {#if entry.source}<span class="source">{entry.source}</span>{/if}
          </span>
        </li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .timeline {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .toolbar {
    align-items: center;
    border-bottom: 1px solid var(--line);
    display: flex;
    flex-wrap: wrap;
    font-family: var(--mono);
    font-size: 0.68rem;
    gap: 0.4rem 0.8rem;
    padding: 0.45rem 0.75rem;
  }
  .toolbar input[type="search"] {
    background: var(--paper);
    border: 1px solid var(--line);
    color: var(--ink);
    font: inherit;
    padding: 0.2rem 0.4rem;
    width: 9rem;
  }
  .kind {
    align-items: center;
    color: var(--muted);
    display: inline-flex;
    gap: 0.25rem;
  }
  .kind input {
    accent-color: var(--ink);
    margin: 0;
  }
  .spacer {
    flex: 1;
  }
  .tool {
    background: none;
    border: 1px solid var(--line);
    color: var(--ink);
    cursor: pointer;
    font: inherit;
    padding: 0.15rem 0.5rem;
  }
  .tool[aria-pressed="true"] {
    background: var(--faint);
  }
  .empty {
    color: var(--muted);
    font-family: var(--serif);
    font-style: italic;
    margin: 0;
    padding: 2rem;
  }
  .rows {
    flex: 1;
    list-style: none;
    margin: 0;
    min-height: 0;
    overflow: auto;
    padding: 0.25rem 0;
  }
  .row {
    align-items: baseline;
    border-left: 2px solid transparent;
    display: grid;
    font-size: 0.74rem;
    gap: 0.75rem;
    grid-template-columns: 4.5rem 6rem minmax(6rem, 13rem) minmax(0, 1fr);
    padding: 0.12rem 0.75rem;
  }
  .row:hover {
    background: var(--faint);
  }
  .row.computed {
    border-left-color: var(--ink);
  }
  .row.updated {
    border-left-color: var(--pulse);
  }
  .row.alert {
    border-left-color: var(--alert);
  }
  .row.alert .what,
  .row.alert .detail {
    color: var(--alert);
  }
  .when {
    color: var(--muted);
    font-family: var(--mono);
    font-variant-numeric: tabular-nums;
  }
  .what {
    color: var(--muted);
    font-family: var(--mono);
  }
  .atom {
    background: none;
    border: 0;
    color: var(--ink);
    cursor: pointer;
    font: inherit;
    font-family: var(--mono);
    overflow: hidden;
    padding: 0;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .atom.plumbing {
    color: var(--muted);
  }
  .atom.inline {
    font-style: normal;
    text-decoration: underline dotted var(--muted);
    text-underline-offset: 3px;
  }
  .detail {
    font-family: var(--serif);
    font-style: italic;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .source {
    border: 1px solid var(--line);
    color: var(--muted);
    font-family: var(--mono);
    font-size: 0.6rem;
    font-style: normal;
    margin-left: 0.5rem;
    padding: 0 0.3rem;
  }
</style>
