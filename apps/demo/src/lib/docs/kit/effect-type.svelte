<!--
  @component
  An effect's type, `Effect<Success, Error>`, with the side its last result landed on lit up: the
  success type in green after a Success, the error type in red after a Failure, neither before
  the first result. Shows that an effect's type names both ways it can end.

  ```svelte
  <EffectType error="UnsupportedAlgorithm" name="digest(…)" result={hash.current} success="string" />
  ```
-->
<script lang="ts">
  import type { AsyncResult } from "effect/reactivity";

  interface Props {
    /** The error type, as written in the code. */
    readonly error: string;
    /** What has the type, such as `digest(…)`; shown before it. */
    readonly name?: string;
    readonly result: AsyncResult.AsyncResult<unknown, unknown>;
    /** The success type, as written in the code. */
    readonly success: string;
  }

  const { error, name, result, success }: Props = $props();
</script>

<code class="effect-type not-prose" data-testid="effect-type" data-tag={result._tag}
  >{#if name}<span class="muted">{name}:&nbsp;</span>{/if}<span class="muted">Effect&lt;</span
  ><span class="side success">{success}</span><span class="muted">,&nbsp;</span><span
    class="side error">{error}</span
  ><span class="muted">&gt;</span></code
>

<style>
  .effect-type {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    white-space: pre;
  }
  .muted {
    color: var(--muted-foreground);
  }
  .side {
    border-radius: var(--radius-sm);
    color: var(--muted-foreground);
    padding: 0.05rem 0.15rem;
    transition:
      background-color 200ms,
      color 200ms;
  }
  [data-tag="Success"] .success {
    background: color-mix(in oklab, var(--tone-success) 18%, transparent);
    color: var(--tone-success-text);
  }
  [data-tag="Failure"] .error {
    background: color-mix(in oklab, var(--tone-failure) 18%, transparent);
    color: var(--tone-failure-text);
  }
</style>
