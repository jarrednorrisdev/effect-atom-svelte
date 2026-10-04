<script module lang="ts">
  import { Data, Effect } from "effect";
  import { Atom } from "effect/reactivity";

  class UnsupportedAlgorithm extends Data.TaggedError("UnsupportedAlgorithm")<{
    readonly algorithm: string;
  }> {}

  const toHex = (buffer: ArrayBuffer) =>
    Array.from(new Uint8Array(buffer), (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("");

  // crypto.subtle.digest is a promise API. tryPromise runs it when the effect
  // runs, and turns a rejection into a typed error.
  // Effect<string, UnsupportedAlgorithm>
  const digest = (algorithm: string, text: string) =>
    Effect.tryPromise({
      catch: () => new UnsupportedAlgorithm({ algorithm }),
      try: () => crypto.subtle.digest(algorithm, new TextEncoder().encode(text)),
    }).pipe(Effect.map(toHex));

  const algorithmAtom = Atom.make("SHA-256");
  const textAtom = Atom.make("Hello, Effect");
  // Runs the effect again whenever either input changes.
  const hashAtom = Atom.make((get) => digest(get(algorithmAtom), get(textAtom)));
</script>

<script lang="ts">
  import { useAtom, useAtomValue } from "effect-atom-svelte";
  import CauseView from "#lib/docs/kit/cause-view.svelte";
  import EffectType from "#lib/docs/kit/effect-type.svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  const algorithm = useAtom(algorithmAtom);
  const text = useAtom(textAtom);
  const hash = useAtomValue(hashAtom);
</script>

<p>
  <input aria-label="Text" bind:value={text.current} data-testid="hash-text" />
</p>
<div aria-label="Algorithm" class="flex flex-wrap items-center gap-2" role="group">
  {#each ["SHA-256", "SHA-1", "MD5"] as name (name)}
    <button
      aria-pressed={algorithm.current === name}
      onclick={() => (algorithm.current = name)}
    >
      {name}
    </button>
  {/each}
  <span class="text-xs text-muted-foreground">MD5 isn't in Web Crypto.</span>
</div>
<p class="mt-4 mb-3 flex flex-wrap items-center gap-3">
  <EffectType
    error="UnsupportedAlgorithm"
    name="digest(…)"
    result={hash.current}
    success="string"
  />
  <StateBadge data-testid="hash-state" result={hash.current} />
</p>
<div>
  {#if hash.current._tag === "Success"}
    <ResultChip kind="message" label="hashAtom" tone="success">
      <output data-testid="hash">{hash.current.value.slice(0, 16)}…</output>
    </ResultChip>
  {:else if hash.current._tag === "Failure"}
    <CauseView
      cause={hash.current.cause}
      code
      data-testid="hash-cause"
      label="hashAtom"
    />
  {:else}
    <ResultChip kind="message" label="hashAtom" tone="running">Hashing…</ResultChip>
  {/if}
</div>
