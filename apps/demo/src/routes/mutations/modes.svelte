<script module lang="ts">
  import { Data, Effect } from "effect";
  import { Atom } from "effect/reactivity";

  class DiskFull extends Data.TaggedError("DiskFull") {}

  // Turned on by the "Fail the save" toggle.
  const failAtom = Atom.make(false);

  // Saves draft number n after a second and a half, or fails with DiskFull.
  const save = (draft: number, fail: boolean) =>
    Effect.gen(function* saveDraft() {
      yield* Effect.sleep("1500 millis");
      if (fail) {
        return yield* new DiskFull();
      }
      return `draft ${draft}`;
    });

  // A new call interrupts the one in flight. get reads failAtom when the call
  // starts.
  const saveAtom = Atom.fn((draft: number, get) => save(draft, get(failAtom)));
</script>

<script lang="ts">
  import { Cause, Exit } from "effect";
  import { useAtom, useAtomSet, useAtomValue } from "effect-atom-svelte";
  import Part from "#lib/docs/kit/part.svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";
  import { toneOf } from "#lib/docs/kit/tone.ts";

  // One mutation, called three ways.
  const saving = useAtomValue(saveAtom);
  const saveValue = useAtomSet(saveAtom);
  const savePromise = useAtomSet(saveAtom, { mode: "promise" });
  const saveExit = useAtomSet(saveAtom, { mode: "promiseExit" });
  const fail = useAtom(failAtom);

  // What each call gave back, one list per way of calling.
  const results = $state({
    exit: [] as string[],
    promise: [] as string[],
    value: [] as string[],
  });
  let draft = 0;

  const calls = {
    exit: async (n: number) => {
      const exit = await saveExit(n);
      if (Exit.isSuccess(exit)) {
        results.exit.push(`#${n}: Exit.Success("${exit.value}")`);
        return;
      }
      const interrupted = Cause.hasInterruptsOnly(exit.cause);
      const why = interrupted ? "interrupted" : "DiskFull";
      results.exit.push(`#${n}: Exit.Failure, ${why}`);
    },
    promise: async (n: number) => {
      try {
        results.promise.push(`#${n}: resolved "${await savePromise(n)}"`);
      } catch (error) {
        // The typed error itself, or an Error when the call was interrupted.
        const why = error instanceof DiskFull ? "DiskFull" : "interrupted";
        results.promise.push(`#${n}: rejected, ${why}`);
      }
    },
    value: (n: number) => {
      const returned: unknown = saveValue(n);
      results.value.push(`#${n}: returned ${String(returned)}`);
    },
  };

  const call = (mode: keyof typeof calls) => {
    draft += 1;
    void calls[mode](draft);
  };
  // Two calls a moment apart: the second interrupts the first.
  const callTwice = (mode: keyof typeof calls) => {
    call(mode);
    setTimeout(() => call(mode), 300);
  };

  const sites = [
    { code: "save(n)", mode: "value" },
    { code: "await savePromise(n)", mode: "promise" },
    { code: "await saveExit(n)", mode: "exit" },
  ] as const;
</script>

<div class="grid gap-3 lg:grid-cols-3">
  {#each sites as site (site.mode)}
    <Part code label={site.code} top>
      <div class="flex flex-wrap gap-2">
        <button onclick={() => call(site.mode)}>Call</button>
        <button onclick={() => callTwice(site.mode)}>Call twice</button>
      </div>
      <ol
        class="mt-3 mb-0 grid list-none gap-1 p-0 font-mono text-xs"
        data-testid="modes-{site.mode}"
      >
        {#each results[site.mode].slice(-5) as line, index (index)}
          <li class="m-0">{line}</li>
        {:else}
          <li class="m-0 text-muted-foreground">Not called yet.</li>
        {/each}
      </ol>
    </Part>
  {/each}
</div>

<div class="mt-3">
  <Part code label="saveAtom" top>
    <div class="flex flex-wrap items-center gap-3">
      {#if saving.current._tag === "Initial" && !saving.current.waiting}
        <ResultChip kind="message" tone="idle">Not called</ResultChip>
      {:else if saving.current.waiting}
        <ResultChip duration={1500} kind="message" tone="running">
          Saving…
        </ResultChip>
      {:else}
        <ResultChip kind="message" tone={toneOf(saving.current)}>
          {saving.current._tag === "Success" ? saving.current.value : "Failed"}
        </ResultChip>
      {/if}
      <StateBadge data-testid="modes-state" result={saving.current} />
    </div>
    <div class="mt-3 flex flex-wrap items-center gap-2">
      <button
        data-cue="interrupt"
        disabled={!saving.current.waiting}
        onclick={() => saveValue(Atom.Interrupt)}
      >
        Cancel
      </button>
      <button data-cue="reset" onclick={() => saveValue(Atom.Reset)}>
        Reset
      </button>
      <button
        aria-pressed={fail.current}
        onclick={() => (fail.current = !fail.current)}
      >
        Fail the save
      </button>
    </div>
  </Part>
</div>
