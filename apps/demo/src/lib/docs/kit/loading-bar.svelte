<!--
  @component
  A thin bar that sweeps while something is in flight, with a caption naming the step, so a wait
  reads as work rather than lag. Its space is kept when idle, so the layout doesn't jump.

  ```svelte
  <LoadingBar label={creating.current.waiting ? "Running createTodo" : undefined} />
  ```

  It shows while `label` is set. Under reduced motion the bar holds still at half opacity instead
  of sweeping. The caption is announced politely to screen readers.
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
    margin-bottom: 0.5rem;
  }
  .track {
    background: color-mix(in oklab, var(--tone-running) 15%, transparent);
    border-radius: 999px;
    height: 3px;
    opacity: 0;
    overflow: hidden;
    transition: opacity 0.2s;
  }
  .sweep {
    background: var(--tone-running);
    border-radius: inherit;
    height: 100%;
    width: 40%;
  }
  .caption {
    color: var(--muted-foreground);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    line-height: 1rem;
    margin: 0.35rem 0 0;
    min-height: 1rem;
  }
  [data-active] .track {
    opacity: 1;
  }
  [data-active] .sweep {
    animation: sweep 1.1s ease-in-out infinite;
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
      opacity: 0.5;
      width: 100%;
    }
  }
</style>
