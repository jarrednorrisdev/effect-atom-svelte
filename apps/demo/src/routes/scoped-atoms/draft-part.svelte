<!--
  A part of the scoped atoms examples, labelled and colored by the draft atom it has: an editor
  that provides Draft ("Note A: Draft.provide()"), or a component that uses it ("Toolbar:
  Draft.use() → Note A"). Every part with the same atom shares a color, so the nesting shows which
  provider each component found. Not part of the examples' code.
-->
<script lang="ts">
  import Part from "#lib/docs/kit/part.svelte";
  import type { Atom } from "effect/reactivity";
  import type { Snippet } from "svelte";

  import { colorOf, nameProvider, providerOf } from "./providers.ts";

  interface Props {
    readonly atom: Atom.Atom<string>;
    readonly children: Snippet;
    readonly name: string;
    /** This part provides the atom (an editor), rather than using it. */
    readonly provides?: boolean;
  }

  const { atom, children, name, provides = false }: Props = $props();

  // An editor names its atom before its children render, so they can look it up.
  // svelte-ignore state_referenced_locally
  if (provides) {
    nameProvider(atom, name);
  }

  const color = $derived(colorOf(atom));
  const label = $derived(
    provides ? `${name}: Draft.provide()` : `${name}: Draft.use() → ${providerOf(atom)}`
  );
</script>

<div class="draft" style:--draft-mark={color.mark} style:--draft-text={color.text}>
  <Part code {label}>
    {@render children()}
  </Part>
</div>

<style>
  .draft > :global(.part) {
    --mark: var(--draft-mark);
    background: color-mix(in oklab, var(--draft-mark) 5%, var(--background));
  }
  .draft > :global(.part > .head .label) {
    color: var(--draft-text);
  }
</style>
