<script module lang="ts">
  import { Cause, Data, Effect, Option } from "effect";
  import { Atom } from "effect/reactivity";

  class UnsupportedAlgorithm extends Data.TaggedError("UnsupportedAlgorithm")<{
    readonly algorithm: string;
  }> {}

  const toHex = (buffer: ArrayBuffer) =>
    Array.from(new Uint8Array(buffer), (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("");

  // crypto.subtle.digest is a promise API. tryPromise runs it when the effect runs,
  // and turns a rejection into a typed error.
  const digest = (algorithm: string, text: string) =>
    Effect.tryPromise({
      catch: () => new UnsupportedAlgorithm({ algorithm }),
      try: () => crypto.subtle.digest(algorithm, new TextEncoder().encode(text)),
    }).pipe(Effect.map(toHex));

  const algorithmAtom = Atom.make("SHA-256");
  const textAtom = Atom.make("Hello, Effect");
  // Runs the effect again whenever either input changes.
  const hashAtom = Atom.make((get) => digest(get(algorithmAtom), get(textAtom)));

  // A Failure holds a Cause. Its typed error is there unless the effect died or was
  // interrupted, which leaves none.
  const describe = (cause: Cause.Cause<UnsupportedAlgorithm>) =>
    Option.match(Cause.findErrorOption(cause), {
      onNone: () => Cause.pretty(cause),
      onSome: (error) => `${error._tag}: Web Crypto has no ${error.algorithm}`,
    });
</script>

<script lang="ts">
  import { useAtom, useAtomValue } from "effect-atom-svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  const algorithm = useAtom(algorithmAtom);
  const text = useAtom(textAtom);
  const hash = useAtomValue(hashAtom);
</script>

<p class="flex flex-wrap gap-2">
  <input aria-label="Text" bind:value={text.current} data-testid="hash-text" />
  <select
    aria-label="Algorithm"
    bind:value={algorithm.current}
    data-testid="hash-algorithm"
  >
    <option>SHA-256</option>
    <option>SHA-1</option>
    <option>MD5</option>
  </select>
</p>
<div class="flex flex-wrap items-baseline gap-3">
  {#if hash.current._tag === "Success"}
    <ResultChip kind="message" label="hashAtom" tone="success">
      <output data-testid="hash" style:word-break="break-all">
        {hash.current.value}
      </output>
    </ResultChip>
  {:else if hash.current._tag === "Failure"}
    <ResultChip kind="message" label="hashAtom" tone="failure">
      <output data-testid="hash">{describe(hash.current.cause)}</output>
    </ResultChip>
  {:else}
    <ResultChip kind="message" label="hashAtom" tone="running">Hashing…</ResultChip>
  {/if}
  <StateBadge data-testid="hash-state" result={hash.current} />
</div>
