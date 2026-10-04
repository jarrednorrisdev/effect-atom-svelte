<!--
  One atom of the lifetimes example as a box, after the reference counts in Effect's RcMap post:
  how many readers hold it (0, 1, 2, 1, 0), and what the registry last did with it, read from the
  example's log. Not part of the example's code.
-->
<script lang="ts">
  import Part from "#lib/docs/kit/part.svelte";
  import { play } from "#lib/docs/kit/sound.ts";
  import { exampleTouched, getExampleState } from "#lib/docs/kit/tone.ts";
  import type { Tone } from "#lib/docs/kit/tone.ts";
  import type { Atom } from "effect/reactivity";
  import type { Snippet } from "svelte";

  interface Props {
    readonly atom: Atom.Atom<unknown>;
    readonly children: Snippet;
    /** What the count counts; "readers" by default. */
    readonly countLabel?: string;
    readonly events: readonly { readonly atom: string; readonly event: string }[];
    readonly name: string;
    readonly readers: number;
  }

  const {
    atom,
    children,
    countLabel = "readers",
    events,
    name,
    readers,
  }: Props = $props();

  const example = getExampleState();

  // The latest event for this atom.
  const last = $derived.by(() => {
    let found: string | undefined;
    for (const entry of events) {
      if (entry.atom === name) {
        found = entry.event;
      }
    }
    return found;
  });
  const ttl = $derived(atom.keepAlive ? undefined : atom.idleTTL);

  // How long the atom has had no reader while it still holds its value.
  const idle = $derived(last === "computed" && readers === 0 && ttl !== undefined);
  let idleMs = $state(0);
  $effect(() => {
    if (!idle) {
      return undefined;
    }
    const start = performance.now();
    idleMs = 0;
    const timer = setInterval(() => (idleMs = performance.now() - start), 100);
    return () => clearInterval(timer);
  });

  const status = $derived.by(() => {
    if (last === undefined) {
      return "not computed yet";
    }
    if (last === "disposed") {
      return "disposed";
    }
    if (readers > 0) {
      return "mounted";
    }
    if (atom.keepAlive) {
      return "no readers, kept alive";
    }
    if (idle) {
      return `no readers for ${(idleMs / 1000).toFixed(1)} s`;
    }
    return "no readers";
  });

  const tone = $derived.by((): Tone => {
    if (last !== "computed") {
      return "idle";
    }
    return idle ? "running" : "success";
  });

  // Disposal is the moment this example is about, so it plays the "back to the start" cue.
  $effect(() => {
    if (last === "disposed" && exampleTouched(example)) {
      play("reset");
    }
  });
</script>

<Part
  code
  count={readers}
  {countLabel}
  dashed={last !== "computed"}
  data-testid="lifetimes-{name}"
  label={name}
  {tone}
>
  <p class="status" data-testid="lifetimes-{name}-status">
    {status}
    {#if ttl !== undefined}<span class="ttl">idle TTL {ttl / 1000} s</span>{/if}
  </p>
  {#if idle && ttl !== undefined}
    <div class="bar" style:--idle={Math.min(1, idleMs / ttl)}></div>
  {/if}
  {@render children()}
</Part>

<style>
  .status {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    margin: 0;
  }
  .ttl {
    color: var(--muted-foreground);
    display: block;
  }
  .bar {
    background: var(--muted);
    border-radius: 999px;
    height: 0.25rem;
    margin-top: 0.3rem;
    overflow: hidden;
    position: relative;
  }
  /* Fills as the idle time runs towards the TTL. */
  .bar::after {
    background: var(--tone-running);
    content: "";
    inset: 0;
    position: absolute;
    transform: scaleX(var(--idle));
    transform-origin: left;
    transition: transform 100ms linear;
  }
</style>
