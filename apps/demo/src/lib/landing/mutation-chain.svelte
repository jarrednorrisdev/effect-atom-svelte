<!--
  @component
  The chain one mutation sets off in example 04: createTodo, its "todos" key, todosAtom refetching,
  openCountAtom following. The first time it scrolls into view, each step lights up in turn;
  Replay runs it again. Under reduced motion it stays still, and there is no Replay.

  ```svelte
  <MutationChain />
  ```
-->
<script lang="ts">
  import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
  import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
  import type { Attachment } from "svelte/attachments";

  /** Each step, declared once, where its atom is defined. */
  const chain = [
    { name: "createTodo", note: "a mutation" },
    { name: '"todos"', note: "its key" },
    { name: "todosAtom", note: "refetches" },
    { name: "openCountAtom", note: "follows" },
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
  <ol class="m-0 flex list-none flex-wrap items-start gap-x-1.5 gap-y-3 p-0" data-played={played || undefined}>
    {#each chain as step, index (step.name)}
      <li class="flex items-start gap-1.5">
        {#if index > 0}
          <ArrowRightIcon aria-hidden="true" class="mt-1.5 size-3.5 shrink-0 text-subtle-foreground" />
        {/if}
        <span class="grid gap-1">
          <code class="step font-mono text-xs" style:--step={index}>{step.name}</code>
          <span class="text-xs text-muted-foreground">{step.note}</span>
        </span>
      </li>
    {/each}
  </ol>
  {/key}
  <figcaption class="mt-3 flex items-start gap-3 text-xs text-muted-foreground">
    <span class="flex-1">
      One mutation, and every atom downstream follows, along with the components that read them. Each
      link is declared once, where its atom is defined; the mutation names only its key.
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
  .step {
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 0.2rem 0.45rem;
  }
  /* The change runs down the chain once: each step lights up in turn. */
  @media (prefers-reduced-motion: no-preference) {
    [data-played] .step {
      animation: step 0.5s ease-out both;
      animation-delay: calc(0.15s + var(--step) * 0.22s);
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
