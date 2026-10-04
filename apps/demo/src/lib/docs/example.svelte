<script lang="ts">
  import * as Tabs from "#lib/components/ui/tabs/index.ts";
  import Hint from "#lib/docs/kit/hint.svelte";
  import { play } from '#lib/docs/kit/sound.ts';
import type { Cue } from '#lib/docs/kit/sound.ts';
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
   */
  const {
    children,
    files,
    hint,
  }: { children?: Snippet; files: readonly ExampleFile[]; hint?: string } = $props();

  const example = setExampleState({ touched: false });
  const touch = () => {
    example.touched = true;
  };

  const cues = new Set<string>(["failure", "interrupt", "reset", "start", "success", "tap", "tick"]);
  const isCue = (value: string): value is Cue => cues.has(value);

  /** One delegated listener plays every control's cue, so examples need no sound code. */
  const onclick = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) {
      return;
    }
    const control = event.target.closest<HTMLElement>(
      "[data-cue], button, input[type=checkbox], input[type=radio]"
    );
    if (!control || control.matches(":disabled")) {
      return;
    }
    const cue = control.dataset.cue ?? "tap";
    if (isCue(cue)) {
      play(cue);
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
</script>

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
  <!-- Scrolls sideways when the file names are wider than a phone. -->
  <div
    class={[
      "not-prose flex items-end overflow-x-auto border bg-muted/40 px-2",
      children ? "rounded-none" : "rounded-t-lg",
    ]}
  >
    {#if files.length > 1}
      <Tabs.Root bind:value={selected}>
        <Tabs.List class="h-auto w-max gap-0 p-0" variant="line">
          {#each files as entry (entry.name)}
            <Tabs.Trigger class="example-tab after:hidden" value={entry.name}>{entry.name}</Tabs.Trigger>
          {/each}
        </Tabs.List>
      </Tabs.Root>
    {:else}
      <span class="example-tab" data-active>{file?.name}</span>
    {/if}
  </div>
  <div role="tabpanel">
    <!-- Highlighted at build time by vite/highlight.ts from the example's own files, copy button
         included. -->
    {@html file?.html}
  </div>
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
  /* An editor tab, as in effect.website's titled code frames. */
  :global(.example-tab) {
    background: transparent;
    border: 1px solid transparent;
    border-bottom: 0;
    border-radius: 0;
    color: var(--muted-foreground);
    flex: none;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    height: auto;
    margin-bottom: -1px;
    padding: 0.4rem 0.9rem;
    position: relative;
  }
  :global(.example-tab[data-active]),
  :global(.example-tab[data-state="active"]) {
    background: var(--background);
    border-color: var(--border);
    box-shadow: inset 0 2px 0 var(--brand);
    color: var(--foreground);
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
</style>
