<!--
  @component
  An effect's type, `Effect<Success, Error>`, with the side its last result landed on lit up: the
  success type in green after a Success, the error type in red after a Failure, neither before
  the first result. Shows that an effect's type names both ways it can end.

  ```svelte
  <EffectType error="UnsupportedAlgorithm" name="digest(…)" result={hash.current} success="string" />
  ```

  Pass the error type's members as an array (`["NotFound", "Forbidden"]`) for a union of tagged
  errors: only the member whose `_tag` the failure carries lights up.
-->
<script lang="ts">
  import { Cause, Option } from "effect";
  import type { AsyncResult } from "effect/reactivity";

  interface Props {
    /** The error type as written in the code, or a union's tagged members. */
    readonly error: string | readonly string[];
    /** What has the type, such as `digest(…)`; shown before it. */
    readonly name?: string;
    readonly result: AsyncResult.AsyncResult<unknown, unknown>;
    /** The success type, as written in the code. */
    readonly success: string;
  }

  const { error, name, result, success }: Props = $props();

  const members = $derived(typeof error === "string" ? [error] : error);

  // The member that failed: the typed error's _tag for a union, the whole type otherwise.
  const failed = $derived.by(() => {
    if (result._tag !== "Failure") {
      return undefined;
    }
    if (typeof error === "string") {
      return error;
    }
    return Option.match(Cause.findErrorOption(result.cause), {
      onNone: () => undefined,
      onSome: (value) =>
        typeof value === "object" && value !== null && "_tag" in value
          ? String(value._tag)
          : undefined,
    });
  });
</script>

<code class="effect-type not-prose" data-testid="effect-type" data-tag={result._tag}
  >{#if name}<span class="muted">{name}:&nbsp;</span>{/if}<span class="muted">Effect&lt;</span
  ><span class="side success">{success}</span><span class="muted">,&nbsp;</span
  >{#each members as member, index (member)}{#if index > 0}<span class="muted"
        >&nbsp;|&nbsp;</span
      >{/if}<span class={["side", member === failed && "failed"]} data-member={member}
      >{member}</span
    >{/each}<span class="muted">&gt;</span></code
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
  .failed {
    background: color-mix(in oklab, var(--tone-failure) 18%, transparent);
    color: var(--tone-failure-text);
  }
</style>
