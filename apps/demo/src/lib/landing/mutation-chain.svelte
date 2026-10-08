<!--
  @component
  The chain one mutation sets off in example 04: createTodo, its "todos" key, todosAtom refetching,
  openCountAtom following. It runs down the page, a node on a line for each step with its note
  beside it, so it never wraps. The first time it scrolls into view, each step lights up in turn;
  Replay runs it again. Under reduced motion it stays still, and there is no Replay.

  ```svelte
  <MutationChain />
  ```
-->
<script lang="ts">
  import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
  import type { Attachment } from "svelte/attachments";

  /** Each step, declared once, where its atom is defined. */
  const chain = [
    { name: "createTodo", note: "succeeds" },
    { name: '"todos"', note: "the key it names" },
    { name: "todosAtom", note: "tagged with it, so it fetches again" },
    { name: "openCountAtom", note: "derived from it, so it updates" },
  ] as const;

  let played = $state(false);
  // Each replay renders the steps afresh, which restarts their animation.
  let run = $state(0);
  const replay = () => {
    played = true;
    run += 1;
  };

  // Plays the steps once, when the chain is mostly on screen.
  const play: Attachment<HTMLElement> = (element) => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          played = true;
          observer.disconnect();
        }
      },
      { threshold: 0.8 }
    );
    observer.observe(element);
    return () => observer.disconnect();
  };
</script>

<figure
  class="mt-6 mb-0 rounded-xl border bg-background p-4"
  data-testid="chain"
  {@attach play}
>
  {#key run}
  <ol class="chain m-0 list-none p-0" data-played={played || undefined}>
    {#each chain as step, index (step.name)}
      <li style:--step={index}>
        <span aria-hidden="true" class="node"></span>
        <code class="step font-mono text-xs">{step.name}</code>
        <span class="text-xs text-muted-foreground">{step.note}</span>
      </li>
    {/each}
  </ol>
  {/key}
  <figcaption class="mt-3 flex items-start gap-3 text-xs text-muted-foreground">
    <span class="flex-1">
      What one successful createTodo sets off: the key it names, the query tagged with that key, and
      the atom derived from the query.
    </span>
    <button
      aria-label="Replay"
      class="replay -mt-1 -mr-1 inline-flex size-7 shrink-0 items-center justify-center rounded-md hover:bg-muted hover:text-foreground"
      onclick={replay}
      title="Replay"
      type="button"
    >
      <RotateCcwIcon class="size-3.5" />
    </button>
  </figcaption>
</figure>

<style>
  /* Three columns shared by every step, so the chips and their notes line up: the line with its
     nodes, the step, and its note. */
  .chain {
    column-gap: 0.75rem;
    display: grid;
    grid-template-columns: 0.5rem auto minmax(0, 1fr);
    row-gap: 0.6rem;
  }
  .chain li {
    align-items: center;
    display: grid;
    grid-column: 1 / -1;
    grid-template-columns: subgrid;
  }
  .chain li {
    position: relative;
  }
  /* The line from this step's node to the next one's: half this row, the gap, half the next. */
  .chain li:not(:last-child)::before {
    background: var(--border-strong);
    content: "";
    height: calc(100% + 0.6rem);
    left: calc(0.25rem - 0.5px);
    position: absolute;
    top: 50%;
    width: 1px;
  }
  .node {
    background: var(--background);
    border: 1.5px solid var(--subtle-foreground);
    border-radius: 50%;
    height: 0.5rem;
    position: relative;
    width: 0.5rem;
  }
  .step {
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 0.2rem 0.45rem;
  }
  /* The change runs down the chain once: each step lights up in turn. */
  @media (prefers-reduced-motion: no-preference) {
    [data-played] .step,
    [data-played] .node {
      animation: step 1.6s ease-in-out both;
      animation-delay: calc(0.3s + var(--step) * 1.1s);
    }
  }
  /* Nothing moves under reduced motion, so there is nothing to replay. */
  @media (prefers-reduced-motion: reduce) {
    .replay {
      display: none;
    }
  }
  @keyframes step {
    40% {
      background: color-mix(in oklab, var(--tone-running) 22%, transparent);
      border-color: var(--tone-running);
    }
  }
</style>
