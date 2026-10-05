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
  import { useAtomValue } from "effect-atom-svelte";
  import type { Snippet } from "svelte";

  import { logAtom } from "./lifecycle-log.ts";

  interface Props {
    readonly atom: Atom.Atom<unknown>;
    readonly children: Snippet;
    /** What the count counts; "readers" by default. */
    readonly countLabel?: string;
    readonly name: string;
    readonly readers: number;
  }

  const {
    atom,
    children,
    countLabel = "readers",
    name,
    readers,
  }: Props = $props();

  const example = getExampleState();
  const log = useAtomValue(logAtom);

  // The latest event for this atom.
  const last = $derived.by(() => {
    let found: string | undefined;
    for (const entry of log.current) {
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
      return "held";
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
  <!-- Top-aligned, with room kept for the TTL line and bar, so each atom's buttons line up with
    its neighbours' as readers come and go. -->
  <div class="holder">
    <div class="state">
      <p class="status" data-testid="lifetimes-{name}-status">
        {status}
        {#if ttl !== undefined}<span class="ttl">idle TTL {ttl / 1000} s</span>{/if}
      </p>
      {#if idle && ttl !== undefined}
        <div class="bar" style:--ttl="{ttl}ms"></div>
      {/if}
    </div>
    {@render children()}
  </div>
</Part>

<style>
  .holder {
    height: 100%;
  }
  .state {
    font-size: 0.75rem;
    /* Two lines of status and the bar below them. */
    min-height: calc(2lh + 0.55rem);
  }
  .status {
    font-family: var(--font-mono);
    /* Digits of one width, so the ticking seconds don't resize the box. */
    font-variant-numeric: tabular-nums;
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
