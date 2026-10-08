<!--
  The drawing set: a cover sheet with the registry's totals and a list of sheets, then one sheet
  per atom with its title block, its value, its readers, what it reads and what reads it, and what
  happened to it lately.
-->
<script lang="ts">
  import { detail, stateText } from "./format.ts";
  import type { AtomView, Model, TimelineEntry } from "./model.svelte.ts";
  import { openInEditor, shortPlace } from "./names.ts";

  interface Props {
    readonly model: Model;
    readonly showPlumbing: boolean;
    /** The atom whose sheet is open, or `undefined` for the cover sheet. */
    readonly selected: number | undefined;
    readonly onselect: (id: number | undefined) => void;
  }

  const { model, showPlumbing, selected, onselect }: Props = $props();

  const byId = $derived(new Map(model.atoms.map((view) => [view.id, view])));
  // The set: live atoms by name, plumbing last. A removed atom keeps its sheet while it is open.
  const sheets = $derived(
    model.atoms
      .filter(
        (view) =>
          (view.live || view.id === selected) &&
          (showPlumbing || !view.plumbing || view.id === selected)
      )
      .toSorted(
        (a, b) =>
          Number(a.plumbing) - Number(b.plumbing) || a.name.localeCompare(b.name)
      )
  );
  const current = $derived(selected === undefined ? undefined : byId.get(selected));
  const number = $derived(
    current === undefined ? 0 : sheets.findIndex((view) => view.id === current.id) + 1
  );
  const recent = $derived(
    current === undefined
      ? []
      : model.timeline
          .filter((entry) => entry.atom === current.id)
          .slice(-12)
          .toReversed()
  );

  const pad = (count: number) => String(count).padStart(2, "0");
  const ttl = (view: AtomView) => {
    if (view.keepAlive) {
      return "—";
    }
    if (view.idleTTL === undefined || view.idleTTL === 0) {
      return "none";
    }
    return view.idleTTL >= 1000 ? `${view.idleTTL / 1000} s` : `${view.idleTTL} ms`;
  };
  const time = (entry: TimelineEntry) => `${(entry.time / 1000).toFixed(3)} s`;
  const verbs: Record<TimelineEntry["tag"], string> = {
    Built: "computed",
    Finalized: "finalized",
    Interrupted: "interrupted",
    NodeAdded: "added",
    NodeRemoved: "removed",
    ReadersChanged: "readers",
    Updated: "updated",
  };
  const states = $derived(
    Object.entries(model.totals.states).toSorted(([a], [b]) => a.localeCompare(b))
  );
</script>

{#snippet link(id: number)}
  {@const view = byId.get(id)}
  <button class="link" class:plumbing={view?.plumbing} onclick={() => onselect(id)} type="button">
    {view?.name ?? `atom #${id}`}
  </button>
{/snippet}

<div class="set">
  <nav aria-label="Sheets" class="index">
    <button class="entry" class:current={current === undefined} onclick={() => onselect(undefined)} type="button">
      <span class="no">00</span> Cover sheet
    </button>
    {#each sheets as view, index (view.id)}
      <button class="entry" class:current={current?.id === view.id} class:plumbing={view.plumbing} class:gone={!view.live} onclick={() => onselect(view.id)} type="button">
        <span class="no">{pad(index + 1)}</span>
        {view.name}
      </button>
    {/each}
  </nav>

  <article class="sheet">
    {#if current === undefined}
      <header class="strip">
        <span><b>SHEET 00</b> OF {pad(sheets.length)}</span>
        <span>COVER · THE REGISTRY</span>
      </header>
      <div class="totals">
        <div class="total"><b>{pad(model.totals.atoms)}</b><span>atoms</span></div>
        <div class="total"><b>{pad(model.totals.readers)}</b><span>readers</span></div>
        <div class="total"><b>{pad(model.totals.builds)}</b><span>computations</span></div>
        <div class="total"><b>{pad(model.totals.updates)}</b><span>updates</span></div>
        <div class="total"><b>{pad(model.totals.interruptions)}</b><span>interruptions</span></div>
        <div class="total"><b>{pad(model.totals.finalizers)}</b><span>finalizers run</span></div>
      </div>
      <section class="block">
        <h3 class="key">VALUES</h3>
        <p class="states">
          {#each states as [state, count] (state)}
            <span><b>{count}</b> {state === "Value" ? "plain values" : state}</span>
          {/each}
        </p>
        <p class="caption">
          {model.totals.plumbing} of the {model.totals.atoms} atoms are plumbing: made by a runtime, a
          mutation or a store rather than declared by the app. They have no label, and the sheets
          and graph {showPlumbing ? "show them, last" : "leave them out"}.
          Counts of computations and updates start when the panel does.
        </p>
      </section>
    {:else}
      <header class="strip">
        <span><b>SHEET {pad(number)}</b> OF {pad(sheets.length)}</span>
        <span>{current.live ? (current.plumbing ? "PLUMBING" : "ATOM") : "REMOVED"}</span>
      </header>

      <section class="block value">
        <h3 class="key">
          VALUE{#if current.state._tag !== "Value"}<span
            class="badge"
            class:failure={current.state._tag === "Failure" && !current.state.waiting}
            class:success={current.state._tag === "Success" && !current.state.waiting}
            class:waiting={current.state.waiting}>{stateText(current.state)}</span>{/if}
        </h3>
        {#if current.hasValue}
          <pre>{detail(current.value)}</pre>
        {:else}
          <p class="caption">Not computed yet.</p>
        {/if}
      </section>

      <div class="columns">
        <section class="block">
          <h3 class="key">UPSTREAM · WHAT IT READS</h3>
          {#if current.parents.length === 0}
            <p class="caption">Nothing: it is a source.</p>
          {:else}
            <ul>
              {#each current.parents as id (id)}<li>{@render link(id)}</li>{/each}
            </ul>
          {/if}
        </section>
        <section class="block">
          <h3 class="key">DOWNSTREAM · WHAT READS IT</h3>
          {#if current.children.length === 0}
            <p class="caption">No atom reads it.</p>
          {:else}
            <ul>
              {#each current.children as id (id)}<li>{@render link(id)}</li>{/each}
            </ul>
          {/if}
        </section>
      </div>

      <section class="block">
        <h3 class="key">LATELY · {current.builds} COMPUTATIONS, {current.updates} UPDATES, {current.interruptions} INTERRUPTIONS</h3>
        {#if recent.length === 0}
          <p class="caption">Nothing since the panel started.</p>
        {:else}
          <ol class="recent">
            {#each recent as entry (entry.seq)}
              <li class:alert={entry.tag === "Interrupted"}>
                <span class="when">{time(entry)}</span>
                <span class="what">{verbs[entry.tag]}</span>
                <span class="detail">{entry.detail}{#if entry.source} ({entry.source}){/if}</span>
              </li>
            {/each}
          </ol>
        {/if}
      </section>

      <footer class="title-block">
        <div class="cell name"><span class="key">NAME</span>{current.name}</div>
        <div class="cell">
          <span class="key">DECLARED</span>
          {#if current.identity.place}
            {@const place = current.identity.place}
            <button class="link" onclick={() => void openInEditor(place)} title="Open {place.file}:{place.line} in the editor" type="button">{shortPlace(place)}</button>
          {:else}
            —
          {/if}
        </div>
        <div class="cell"><span class="key">KEEP-ALIVE</span>{current.keepAlive ? "yes" : "no"}</div>
        <div class="cell"><span class="key">IDLE TTL</span>{ttl(current)}</div>
        <div class="cell"><span class="key">READERS</span>{current.readers}</div>
        {#if current.identity.key && current.identity.key !== current.name}
          <div class="cell wide"><span class="key">KEY</span>{current.identity.key}</div>
        {/if}
      </footer>
    {/if}
  </article>
</div>

<style>
  .set {
    display: grid;
    grid-template-columns: minmax(10rem, 14rem) minmax(0, 1fr);
    height: 100%;
    min-height: 0;
  }
  .index {
    border-right: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: auto;
    padding: 0.75rem 0.75rem 0.75rem 1rem;
  }
  .entry {
    background: none;
    border: 0;
    border-left: 1px solid var(--line);
    color: var(--muted);
    cursor: pointer;
    font: inherit;
    font-family: var(--mono);
    font-size: 0.75rem;
    overflow: hidden;
    padding: 0.2rem 0.6rem;
    position: relative;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .entry:hover {
    color: var(--ink);
  }
  .entry.current {
    border-left-color: var(--accent);
    color: var(--ink);
  }
  .entry.plumbing,
  .entry.gone {
    color: var(--subtle);
  }
  .no {
    color: var(--accent-text);
    font-variant-numeric: tabular-nums;
    margin-right: 0.5rem;
  }
  .sheet {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: auto;
  }
  .strip {
    border-bottom: 1px solid var(--line);
    color: var(--muted);
    display: flex;
    font-family: var(--mono);
    font-size: 0.65rem;
    justify-content: space-between;
    letter-spacing: 0.1em;
    padding: 0.55rem 1rem;
  }
  .strip b {
    color: var(--accent-text);
    font-weight: 400;
  }
  .block {
    border-bottom: 1px solid var(--line);
    padding: 0.75rem 1rem;
  }
  .key {
    color: var(--muted);
    font-family: var(--mono);
    font-size: 0.62rem;
    font-weight: normal;
    letter-spacing: 0.1em;
    margin: 0 0 0.4rem;
  }
  .badge {
    border: 1px solid var(--line);
    border-radius: 999px;
    color: var(--ink);
    margin-left: 0.6rem;
    padding: 0 0.45rem;
  }
  .badge.success {
    border-color: var(--success);
    color: var(--success);
  }
  .badge.failure {
    border-color: var(--alert);
    color: var(--alert);
  }
  .badge.waiting {
    border-color: var(--accent);
    color: var(--accent-text);
  }
  pre {
    background: color-mix(in oklab, var(--ink) 4%, transparent);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 0.5rem 0.65rem;
    font-family: var(--mono);
    font-size: 0.75rem;
    margin: 0;
    max-height: 14rem;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .columns .block:first-child {
    border-right: 1px solid var(--line);
  }
  ul,
  ol {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .link {
    background: none;
    border: 0;
    color: var(--ink);
    cursor: pointer;
    font: inherit;
    font-family: var(--mono);
    font-size: 0.75rem;
    padding: 0;
    text-decoration: underline dotted var(--muted);
    text-underline-offset: 3px;
  }
  .link:hover {
    color: var(--accent-text);
    text-decoration-color: var(--accent);
  }
  .link.plumbing {
    color: var(--muted);
  }
  .caption {
    color: var(--muted);
    font-family: var(--serif);
    font-size: 0.8rem;
    font-style: italic;
    margin: 0;
  }
  .recent li {
    display: grid;
    font-size: 0.72rem;
    gap: 0.75rem;
    grid-template-columns: 5.5rem 6rem minmax(0, 1fr);
    padding: 0.1rem 0;
  }
  .recent li.alert .what,
  .recent li.alert .detail {
    color: var(--alert);
  }
  .when {
    color: var(--muted);
    font-family: var(--mono);
    font-variant-numeric: tabular-nums;
  }
  .what {
    font-family: var(--mono);
  }
  .detail {
    font-family: var(--serif);
    font-style: italic;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .title-block {
    border-top: 1px solid var(--line);
    display: grid;
    grid-template-columns: minmax(0, 1.6fr) minmax(0, 1.6fr) repeat(3, minmax(0, 1fr));
    margin-top: auto;
  }
  .cell {
    white-space: nowrap;
    border-left: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    font-family: var(--mono);
    font-size: 0.78rem;
    gap: 0.15rem;
    overflow: hidden;
    padding: 0.45rem 0.75rem 0.55rem;
    text-overflow: ellipsis;
  }
  .cell:first-child {
    border-left: 0;
  }
  .cell .key {
    margin: 0;
  }
  .cell.wide {
    border-left: 0;
    border-top: 1px solid var(--line);
    grid-column: 1 / -1;
  }
  .totals {
    border-bottom: 1px solid var(--line);
    display: grid;
    grid-template-columns: repeat(3, 1fr);
  }
  .total {
    border-right: 1px solid var(--line);
    border-top: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    padding: 0.75rem 1rem;
  }
  .total:nth-child(-n + 3) {
    border-top: 0;
  }
  .total:nth-child(3n) {
    border-right: 0;
  }
  .total b {
    font-family: var(--mono);
    font-size: 1.5rem;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  .total span {
    color: var(--muted);
    font-family: var(--serif);
    font-style: italic;
  }
  .states {
    display: flex;
    flex-wrap: wrap;
    font-family: var(--mono);
    font-size: 0.78rem;
    gap: 1rem;
    margin: 0 0 0.6rem;
  }
</style>
