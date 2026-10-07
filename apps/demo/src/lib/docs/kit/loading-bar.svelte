<!--
  @component
  A thin track that sweeps while something is in flight, with a caption beside it naming the step,
  so a wait reads as work rather than lag. When idle it stays as a faint line with no caption, so
  the layout doesn't jump and no empty gap opens up.

  ```svelte
  <LoadingBar label={creating.current.waiting ? "Running createTodo" : undefined} />
  ```

  It sweeps while `label` is set. Under reduced motion the bar holds still instead. The caption is
  announced politely to screen readers.
-->
<script lang="ts">
  const { label }: { readonly label?: string | undefined } = $props();
</script>

<div class="loading-bar" data-active={label !== undefined || undefined}>
  <div class="track" aria-hidden="true"><div class="sweep"></div></div>
  <p aria-live="polite" class="caption">{label ?? ""}</p>
</div>

<style>
  .loading-bar {
    align-items: center;
    display: flex;
    gap: 0.75rem;
    margin-block: 0.5rem;
    min-height: 1rem;
  }
  .track {
    background: var(--border);
    border-radius: 999px;
    flex: 1;
    height: 2px;
    overflow: hidden;
    transition: background 0.2s;
  }
  .sweep {
    background: var(--tone-running);
    border-radius: inherit;
    height: 100%;
    opacity: 0;
    width: 40%;
  }
  .caption {
    color: var(--muted-foreground);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    line-height: 1rem;
    margin: 0;
    white-space: nowrap;
  }
  [data-active] .track {
    background: color-mix(in oklab, var(--tone-running) 20%, transparent);
  }
  [data-active] .sweep {
    animation: sweep 1.1s ease-in-out infinite;
    opacity: 1;
  }
  @keyframes sweep {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(250%);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    [data-active] .sweep {
      animation: none;
      opacity: 0.6;
      width: 100%;
    }
  }
</style>
