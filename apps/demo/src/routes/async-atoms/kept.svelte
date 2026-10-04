<script module lang="ts">
  import { Effect } from "effect";
  import { Atom } from "effect/reactivity";

  // An atom whose effect takes a moment, and counts how many times it has run.
  const slowLoad = () => {
    let loads = 0;
    return Atom.make(
      Effect.sync(() => (loads += 1)).pipe(Effect.delay("600 millis"))
    );
  };

  const atoms = [
    { atom: slowLoad(), idle: "disposed at once", name: "plain" },
    { atom: slowLoad().pipe(Atom.keepAlive), idle: "kept", name: "keepAlive" },
    {
      atom: slowLoad().pipe(Atom.setIdleTTL("3 seconds")),
      idle: "kept for 3 seconds",
      name: "idle TTL",
    },
  ] as const;
</script>

<script lang="ts">
  import Part from "#lib/docs/kit/part.svelte";
  import Reader from "./kept-reader.svelte";

  // Whether each atom has a reader on the page.
  const shown = $state({ "idle TTL": true, keepAlive: true, plain: true });
</script>

<div class="grid gap-3 sm:grid-cols-3">
  {#each atoms as { atom, idle, name } (name)}
    <Part
      code
      dashed={!shown[name]}
      label={name}
      tone={shown[name] ? "success" : "idle"}
    >
      <button
        aria-label="{shown[name] ? 'Hide' : 'Show'} reader: {name}"
        onclick={() => (shown[name] = !shown[name])}
      >
        {shown[name] ? "Hide reader" : "Show reader"}
      </button>
      {#if shown[name]}
        <Reader {atom} {name} />
      {:else}
        <p class="mt-3 text-sm">Nothing reads it: {idle}.</p>
      {/if}
    </Part>
  {/each}
</div>
