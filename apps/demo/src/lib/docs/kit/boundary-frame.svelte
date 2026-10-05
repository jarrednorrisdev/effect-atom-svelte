<!--
  @component
  Draws a `<svelte:boundary>` the example renders inside it: a dashed outline labelled with the
  boundary, and an inspector under it lighting up the branch on screen, `pending()`, the content
  or `failed(error, reset)`, plus whether the content is updating. It reads the branch from the
  page: mark each branch's root with `data-branch="pending" | "content" | "failed"`, and an
  "updating" element (shown while `$effect.pending() > 0`) with `data-updating={$effect.pending()}`.
  Once the reader has used the example, it plays `success` when content arrives or an update
  settles, and `failure` when the `failed` snippet takes over.

  ```svelte
  <BoundaryFrame>
    <svelte:boundary>…</svelte:boundary>
  </BoundaryFrame>
  ```
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  import { play } from "./sound.ts";
  import { exampleTouched, getExampleState } from "./tone.ts";

  interface Props {
    readonly children: Snippet;
  }

  const { children }: Props = $props();

  let branch = $state<string>();
  let updating = $state(0);

  const example = getExampleState();

  /** The outcome sound for a change of what the boundary shows, if it ended a load. */
  const outcome = (before: { branch?: string; updating: number }) => {
    if (branch === "failed" && before.branch !== "failed") {
      return "failure";
    }
    const arrived = branch === "content" && before.branch !== "content";
    const settled = branch === "content" && before.updating > 0 && updating === 0;
    return arrived || settled ? "success" : undefined;
  };

  // Watches the boundary's markup for the branch it renders.
  const watch = (frame: HTMLElement) => {
    const read = () => {
      const before = { branch, updating };
      branch = frame.querySelector<HTMLElement>("[data-branch]")?.dataset.branch;
      updating = Number(
        frame.querySelector<HTMLElement>("[data-updating]")?.dataset.updating ?? 0
      );
      const cue = outcome(before);
      if (cue && exampleTouched(example)) {
        play(cue);
      }
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(frame, {
      attributeFilter: ["data-branch", "data-updating"],
      childList: true,
      subtree: true,
    });
    return () => observer.disconnect();
  };

  const slots = [
    { id: "pending", text: "pending()" },
    { id: "content", text: "content" },
    { id: "failed", text: "failed(error, reset)" },
  ];
</script>

<div class="boundary not-prose">
  <span class="name">&lt;svelte:boundary&gt;</span>
  <div {@attach watch}>{@render children()}</div>
</div>
<div aria-label="What the boundary renders" class="inspector not-prose" role="list">
  {#each slots as slot (slot.id)}
    <span
      aria-current={branch === slot.id ? "true" : undefined}
      class="slot"
      data-slot={slot.id}
      role="listitem"
    >
      {slot.text}
    </span>
  {/each}
  <span class="pending" data-testid="effect-pending">
    $effect.pending(): <output>{updating}</output>
  </span>
</div>

<style>
  .boundary {
    border: 1.5px dashed var(--border-strong);
    border-radius: var(--radius-lg);
    padding: 1.1rem 0.9rem 0.9rem;
    position: relative;
  }
  .name {
    /* The example's own background, so the label sits on the outline. */
    background: color-mix(in oklab, var(--brand) 4%, var(--background));
    color: var(--muted-foreground);
    font-family: var(--font-mono);
    font-size: 0.7rem;
    left: 0.75rem;
    padding: 0 0.3rem;
    position: absolute;
    top: -0.55rem;
  }
  .inspector {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.6rem;
  }
  .slot {
    border: 1px solid var(--border);
    border-radius: 999px;
    color: var(--muted-foreground);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    padding: 0.1rem 0.6rem;
    transition:
      background-color 200ms,
      border-color 200ms,
      color 200ms;
  }
  .slot[aria-current] {
    background: color-mix(in oklab, var(--tone-running) 14%, transparent);
    border-color: var(--tone-running);
    color: var(--foreground);
  }
  .slot[data-slot="content"][aria-current] {
    background: color-mix(in oklab, var(--tone-success) 14%, transparent);
    border-color: var(--tone-success);
  }
  .slot[data-slot="failed"][aria-current] {
    background: color-mix(in oklab, var(--tone-failure) 14%, transparent);
    border-color: var(--tone-failure);
  }
  .pending {
    color: var(--muted-foreground);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    margin-left: auto;
  }
</style>
