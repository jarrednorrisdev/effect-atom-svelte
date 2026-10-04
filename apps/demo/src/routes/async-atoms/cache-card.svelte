<!--
  One atom of the "Keeping results" example as a card: how many times its request has run, and
  what the registry holds for it right now (a result, nothing, or a result counting down its idle
  TTL). Not part of the example's code: it looks at the registry from outside, every 100 ms, so it
  never holds the atom itself.
-->
<script lang="ts">
  import Part from "#lib/docs/kit/part.svelte";
  import { play } from "#lib/docs/kit/sound.ts";
  import { exampleTouched, getExampleState } from "#lib/docs/kit/tone.ts";
  import type { Tone } from "#lib/docs/kit/tone.ts";
  import type { Atom } from "effect/reactivity";
  import { getRegistry } from "effect-atom-svelte";

  interface Props {
    readonly atom: Atom.Atom<unknown>;
    readonly name: string;
    /** Whether the page on screen reads the atom. */
    readonly read: boolean;
    /** How many times the atom's request has run. */
    readonly runs: number;
  }

  const { atom, name, read, runs }: Props = $props();

  const example = getExampleState();
  const registry = getRegistry();

  // Whether the registry has a node, and so a result, for the atom.
  // svelte-ignore state_referenced_locally
  let held = $state(registry.getNodes().has(atom));
  $effect(() => {
    const timer = setInterval(() => {
      held = registry.getNodes().has(atom);
    }, 100);
    return () => clearInterval(timer);
  });

  const ttl = $derived(atom.keepAlive ? undefined : atom.idleTTL);
  const kind = $derived.by(() => {
    if (atom.keepAlive) {
      return "keepAlive";
    }
    return ttl === undefined ? "plain" : `idle TTL ${ttl / 1000} s`;
  });

  // How long the atom has held its result with nothing reading it.
  let idleMs = $state(0);
  $effect(() => {
    if (read || !held || ttl === undefined) {
      return undefined;
    }
    const start = performance.now();
    idleMs = 0;
    const timer = setInterval(() => (idleMs = performance.now() - start), 100);
    return () => clearInterval(timer);
  });

  const status = $derived.by(() => {
    if (!held) {
      return runs === 0 ? "nothing yet" : "disposed: the next read runs it again";
    }
    if (read) {
      return "held, read by the dashboard";
    }
    if (atom.keepAlive) {
      return "held: kept alive";
    }
    if (ttl !== undefined) {
      // The registry checks idle atoms about once a second, so disposal can come a little late.
      const left = Math.max(0, (ttl - idleMs) / 1000);
      return `held, unread for ${(idleMs / 1000).toFixed(1)} s (${left.toFixed(1)} s left)`;
    }
    return "disposing";
  });

  const tone = $derived.by((): Tone => {
    if (!held) {
      return "idle";
    }
    return !read && ttl !== undefined ? "running" : "success";
  });

  // Disposal is what the example is about, so it plays the "back to the start" cue.
  let wasHeld = false;
  $effect(() => {
    if (wasHeld && !held && exampleTouched(example)) {
      play("reset");
    }
    wasHeld = held;
  });
</script>

<Part
  code
  count={runs}
  countLabel="runs"
  dashed={!held}
  data-testid="cache-{name}"
  label={name}
  {tone}
>
  <p class="kind">{kind}</p>
  <p class="status" data-testid="cache-{name}-status">{status}</p>
  {#if held && !read && ttl !== undefined}
    <div class="bar" style:--ttl="{ttl}ms"></div>
  {/if}
</Part>

<style>
  .kind {
    color: var(--muted-foreground);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    margin: 0;
  }
  .status {
    font-size: 0.8125rem;
    /* Digits of one width, so the ticking seconds don't resize the box. */
    font-variant-numeric: tabular-nums;
    margin: 0.25rem 0 0;
  }
  .bar {
    background: var(--muted);
    border-radius: 999px;
    height: 0.25rem;
    margin-top: 0.4rem;
    overflow: hidden;
    position: relative;
  }
  /* Fills as the unread time runs towards the TTL. */
  .bar::after {
    /* One CSS animation over the whole TTL, started when the bar appears, so it fills smoothly
       instead of stepping with the 100 ms timer behind the status text. */
    animation: idle-fill var(--ttl) linear forwards;
    background: var(--tone-running);
    content: "";
    inset: 0;
    position: absolute;
    transform-origin: left;
  }
  @keyframes idle-fill {
    from {
      transform: scaleX(0);
    }
    to {
      transform: scaleX(1);
    }
  }
</style>
