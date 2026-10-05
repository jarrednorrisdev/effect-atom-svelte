<!--
  A part of the scoped atoms examples, drawn from the draft atom it has: an editor that provides
  Draft ("Note A: Draft.provide()", with a stripe in its color down the left edge), or a
  component that uses it ("Toolbar: Draft.use()", with a chip naming the editor whose draft it
  found, and a dot in that editor's color). Not part of the examples' code.
-->
<script lang="ts">
  import type { Atom } from "effect/reactivity";
  import type { Snippet } from "svelte";

  import { Draft } from "./draft-scope.ts";
  import { colorOf, nameProvider, providerOf } from "./providers.ts";

  interface Props {
    /** The atom an editor provides. A part without it finds its own with Draft.use(). */
    readonly atom?: Atom.Atom<string>;
    readonly children: Snippet;
    readonly name: string;
  }

  const { atom: provided, children, name }: Props = $props();

  // svelte-ignore state_referenced_locally
  const provides = provided !== undefined;
  // svelte-ignore state_referenced_locally
  const atom = provided ?? Draft.use();
  // An editor names its atom before its children render, so they can look it up.
  // svelte-ignore state_referenced_locally
  if (provides) {
    nameProvider(atom, name);
  }
</script>

<div class={["draft not-prose", provides && "provides"]} style:--draft={colorOf(atom).mark}>
  <div class="head">
    <code class="label">{name}: Draft.{provides ? "provide()" : "use()"}</code>
    {#if !provides}
      <span class="found" title="The editor whose draft Draft.use() found">
        <span aria-hidden="true" class="dot"></span>
        {providerOf(atom)}
      </span>
    {/if}
  </div>
  <div class="body">{@render children()}</div>
</div>

<style>
  .draft {
    background: var(--background);
    border: 1.5px solid color-mix(in oklab, var(--tone-idle) 60%, transparent);
    border-radius: var(--radius-lg);
    padding: 0.6rem 0.8rem;
  }
  /* An editor: a stripe in its color, which its parts' dots match. */
  .provides {
    border-left: 4px solid var(--draft);
  }
  .head {
    align-items: center;
    display: flex;
    gap: 0.5rem;
    justify-content: space-between;
  }
  .label {
    color: var(--muted-foreground);
    font-size: 0.75rem;
    font-weight: 600;
  }
  .found {
    align-items: center;
    border: 1px solid var(--border);
    border-radius: 999px;
    color: var(--muted-foreground);
    display: inline-flex;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    gap: 0.35rem;
    padding: 0.05rem 0.5rem;
    white-space: nowrap;
  }
  .dot {
    background: var(--draft);
    border-radius: 999px;
    height: 0.5rem;
    width: 0.5rem;
  }
  .body {
    font-size: 0.875rem;
    margin-top: 0.4rem;
  }
</style>
