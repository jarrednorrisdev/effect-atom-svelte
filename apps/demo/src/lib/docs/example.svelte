<script lang="ts">
  import * as Tabs from "#lib/components/ui/tabs/index.ts";
  import Hint from "#lib/docs/kit/hint.svelte";
  import { refuse } from "#lib/docs/kit/motion.ts";
  import { play, warm } from "#lib/docs/kit/sound.ts";
  import type { Cue } from "#lib/docs/kit/sound.ts";
  import { setExampleState } from "#lib/docs/kit/tone.ts";
  import type { Snippet } from "svelte";

  /** A source file of an example: its name, and its code from a `?highlight` import. */
  interface ExampleFile {
    readonly html: string;
    readonly name: string;
  }

  /**
   * A live example above its source. Import the source from the same files that render, so the
   * docs show the code that runs:
   *
   * ```svelte
   * <Example files={[{ html: counterSource, name: "counter.svelte" }]}>
   *   <Counter />
   * </Example>
   * ```
   *
   * Without children it shows only the source, for code that runs elsewhere, such as a test.
   *
   * `hint` is the "what to try" line above the result. Every button, checkbox and radio inside the
   * result plays the `tap` sound; give a control `data-cue="<cue>"` for another cue, or
   * `data-cue="none"` for silence. Kit components inside see whether the reader has touched the
   * example yet (`tone.ts`), so a page's own first load plays no outcome sounds.
   *
   * `cap` is how many lines of a long source show before "Show all" (14 by default).
   */
  const {
    cap = 14,
    children,
    files,
    hint,
  }: {
    cap?: number;
    children?: Snippet;
    files: readonly ExampleFile[];
    hint?: string;
  } = $props();

  const cues = new Set<string>([
    "blocked",
    "down",
    "failure",
    "interrupt",
    "reset",
    "start",
    "success",
    "tap",
    "tick",
    "up",
  ]);
  const isCue = (value: string): value is Cue => cues.has(value);

  /** The control a click on the event's target presses, if any. */
  const controlOf = (event: Event): HTMLElement | undefined => {
    if (!(event.target instanceof Element)) {
      return undefined;
    }
    const control = event.target.closest<HTMLElement>(
      "[data-cue], button, input[type=checkbox], input[type=radio]"
    );
    return control && !control.matches(":disabled") ? control : undefined;
  };

  /** The cue a click on the event's target would play, if any. */
  const cueOf = (event: Event): Cue | undefined => {
    const cue = controlOf(event)?.dataset.cue ?? "tap";
    return controlOf(event) && isCue(cue) ? cue : undefined;
  };

  const example = setExampleState({ touched: false });
  const touch = (event: Event) => {
    example.touched = true;
    // A press on a control is about to play a cue: start loading the synthesizer now, inside the
    // gesture, so the click's own sound isn't late.
    const presses = !(event instanceof KeyboardEvent) || event.key === "Enter" || event.key === " ";
    if (presses && cueOf(event)) {
      warm();
    }
  };

  /**
   * One delegated listener plays every control's cue, so examples need no sound code. A `blocked`
   * press is shown too, not only heard.
   */
  const onclick = (event: MouseEvent) => {
    const cue = cueOf(event);
    if (cue) {
      play(cue);
    }
    const control = controlOf(event);
    if (cue === "blocked" && control) {
      refuse(control);
    }
  };

  const listen = (element: HTMLElement) => {
    element.addEventListener("click", onclick);
    element.addEventListener("keydown", touch);
    element.addEventListener("pointerdown", touch);
    return () => {
      element.removeEventListener("click", onclick);
      element.removeEventListener("keydown", touch);
      element.removeEventListener("pointerdown", touch);
    };
  };

  // svelte-ignore state_referenced_locally
  let selected = $state(files[0]?.name ?? "");
  const file = $derived(files.find((entry) => entry.name === selected) ?? files[0]);

  /**
   * A long source shows its first lines, which usually define the atoms, and a button for the
   * rest. Code with no live result above it is the whole point, so it starts open.
   */
  // svelte-ignore state_referenced_locally
  let expanded = $state(!children);
  const lineCount = (html: string) => html.split('class="line"').length - 1;
  // A few hidden lines aren't worth a button.
  const long = (entry: ExampleFile) => lineCount(entry.html) > cap + 4;

  const collapse = (button: HTMLElement) => {
    expanded = false;
    // The block shrinks under the reader: bring its top back into view if it went above.
    const source = button.closest(".source");
    requestAnimationFrame(() => source?.scrollIntoView({ block: "nearest" }));
  };
</script>

{#snippet tabStrip(contents: Snippet)}
  <!-- Scrolls sideways when the file names are wider than a phone. -->
  <div
    class={[
      "not-prose flex items-end overflow-x-auto border bg-muted/40",
      children ? "rounded-none" : "rounded-t-lg",
    ]}
  >
    {@render contents()}
  </div>
{/snippet}

{#snippet tabList()}
  <Tabs.List class="w-max items-end gap-0 p-0 group-data-horizontal/tabs:h-auto" variant="line">
    {#each files as entry (entry.name)}
      <Tabs.Trigger class="example-tab after:hidden" value={entry.name}>{entry.name}</Tabs.Trigger>
    {/each}
  </Tabs.List>
{/snippet}

{#snippet fileName()}
  <span class="example-tab" data-active>{file?.name}</span>
{/snippet}

{#snippet code(entry: ExampleFile)}
  <!-- Highlighted at build time by vite/highlight.ts from the example's own files, copy button
       included. Capped lines stay in the page, so search and the copy button still see them. -->
  {@const capped = long(entry) && !expanded}
  <div
    class="source"
    data-capped={capped || undefined}
    data-expanded={(long(entry) && expanded) || undefined}
    style:--cap={cap}
  >
    {@html entry.html}
    {#if capped}
      <div class="source-fade">
        <button
          aria-expanded="false"
          class="source-toggle"
          onclick={() => (expanded = true)}
          type="button"
        >
          Show all {lineCount(entry.html)} lines
        </button>
      </div>
    {:else if long(entry)}
      <button
        aria-expanded="true"
        class="source-toggle source-collapse"
        onclick={(event) => collapse(event.currentTarget)}
        type="button"
      >
        Show fewer lines
      </button>
    {/if}
  </div>
{/snippet}

<!-- One frame and one shadow round the live result, the tabs and the code. -->
<figure class="example my-8 rounded-lg" data-example>
  <!-- The live output is not indexed for search; the source below is. -->
  {#if children}
    <!-- The listeners only add sound and note that the reader has been here; every control inside
         is a real button or input with its own keyboard handling. -->
    <div
      class="demo rounded-t-lg border border-b-0 px-6 pt-3 pb-6"
      data-pagefind-ignore="all"
      {@attach listen}
    >
      <p class="example-label not-prose">Result</p>
      {#if hint}
        <Hint>{hint}</Hint>
      {/if}
      {@render children()}
    </div>
  {/if}
  {#if files.length > 1}
    <!-- Several files: a tab for each, and a tab panel showing the selected one. Only the selected
         file's code is in the page, so search indexes the code a reader first sees. -->
    <Tabs.Root bind:value={selected} class="gap-0">
      {@render tabStrip(tabList)}
      {#each files as entry (entry.name)}
        <Tabs.Content value={entry.name}>
          {#if entry.name === selected}{@render code(entry)}{/if}
        </Tabs.Content>
      {/each}
    </Tabs.Root>
  {:else}
    <!-- One file: its name above its code, and no tabs to choose between. -->
    {@render tabStrip(fileName)}
    {#if file}<div>{@render code(file)}</div>{/if}
  {/if}
</figure>

<style>
  .example {
    box-shadow: 0.1rem 0.1rem 0.2rem var(--code-shadow);
  }
  /* A light tint of the brand color sets the running example apart from the page around it. */
  .demo {
    background: color-mix(in oklab, var(--brand) 4%, var(--background));
  }
  .example-label {
    color: var(--muted-foreground);
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.06em;
    margin-bottom: 0.75rem;
    text-transform: uppercase;
  }
  /* The label (and hint) space the result from the top edge, so the result's own margins would
     double it. */
  .demo > :global(:nth-child(2)),
  .demo > :global(.hint + *) {
    margin-top: 0;
  }
  .demo > :global(:last-child) {
    margin-bottom: 0;
  }
  .example :global(.code-block) {
    margin: 0;
  }
  .example :global(.shiki) {
    border-radius: 0 0 var(--radius-lg) var(--radius-lg);
    border-top: 0;
    box-shadow: none;
    margin: 0;
  }
  .source {
    position: relative;
  }
  /* The top padding, then `--cap` lines; `lh` is the code's own line height. */
  .source[data-capped] :global(.shiki) {
    max-height: calc(1.25rem + var(--cap) * 1lh);
    overflow-y: hidden;
  }
  /* Room under the last line for Show fewer lines. */
  .source[data-expanded] :global(.shiki) {
    padding-bottom: 3.75rem;
  }
  .source-fade {
    align-items: end;
    background: linear-gradient(transparent, var(--code-background) 60%);
    border-radius: 0 0 var(--radius-lg) var(--radius-lg);
    bottom: 1px;
    display: flex;
    height: 6rem;
    inset-inline: 1px;
    justify-content: center;
    padding-bottom: 0.75rem;
    position: absolute;
  }
  .source-toggle {
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 999px;
    color: var(--foreground);
    cursor: pointer;
    font-size: var(--text-xs);
    font-weight: 600;
    padding: 0.35rem 0.9rem;
  }
  .source-toggle:hover,
  .source-toggle:focus-visible {
    border-color: var(--brand);
  }
  .source-collapse {
    bottom: 0.75rem;
    left: 50%;
    position: absolute;
    translate: -50% 0;
  }
</style>
