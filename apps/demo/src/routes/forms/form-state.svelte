<!--
  @component
  Beside the rename example, not part of it: the form's initial values, whether it's dirty, the
  last successful submit, and the submit's result, so a save visibly turns the submitted title into
  the initial one.
-->
<script lang="ts">
  import { Option } from "effect";
  import type { AsyncResult } from "effect/reactivity";

  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  interface Props {
    /** Whether the last failure is on a field, claimed by mapError. */
    readonly claimed: boolean;
    readonly initial: unknown;
    readonly dirty: boolean;
    readonly lastSubmitted: Option.Option<{
      readonly encoded: unknown;
    }>;
    readonly result: AsyncResult.AsyncResult<
      unknown,
      unknown
    >;
  }

  const {
    claimed,
    dirty,
    initial,
    lastSubmitted,
    result,
  }: Props = $props();
</script>

<section
  aria-label="The form's state"
  class="state"
  data-testid="form-state"
>
  <p class="state-title">The form's state</p>
  <dl>
    <dt><code>form.initialValues</code></dt>
    <dd data-testid="state-initial">
      {JSON.stringify(initial)}
    </dd>
    <dt><code>form.dirty</code></dt>
    <dd
      class={dirty ? "bad" : "ok"}
      data-testid="state-dirty"
    >
      {dirty}
    </dd>
    <dt><code>form.lastSubmitted</code></dt>
    <dd data-testid="state-last">
      {Option.match(lastSubmitted, {
        onNone: () => "none",
        onSome: (last) => JSON.stringify(last.encoded),
      })}
    </dd>
    <dt><code>form.submitResult</code></dt>
    <dd>
      <StateBadge data-testid="state-result" {result} />
      {#if claimed && result._tag === "Initial"}
        <span class="muted" data-testid="state-claimed"
          >claimed by mapError, so it's on the field instead</span
        >
      {/if}
    </dd>
  </dl>
</section>

<style>
  .state {
    border: 1px solid var(--border);
    font-size: 0.8125rem;
    margin-top: 0.75rem;
    padding: 0.75rem 1rem;
  }
  .state-title {
    color: var(--muted-foreground);
    font: 0.7rem var(--font-mono);
    letter-spacing: 0.08em;
    margin: 0 0 0.5rem;
    text-transform: uppercase;
  }
  dl {
    align-items: baseline;
    display: grid;
    gap: 0.375rem 1rem;
    grid-template-columns: max-content 1fr;
    margin: 0;
  }
  /* The page's prose styles space out definition lists; this one is a table. */
  dt,
  dd {
    margin: 0;
    padding: 0;
  }
  dd {
    overflow-wrap: anywhere;
  }
  .muted {
    color: var(--muted-foreground);
    margin-left: 0.5rem;
  }
  .ok {
    color: var(--tone-success-text);
  }
  .bad {
    color: var(--tone-failure-text);
  }
</style>
