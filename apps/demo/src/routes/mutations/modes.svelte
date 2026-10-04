<script module lang="ts">
  import { Data, Effect } from "effect";
  import { Atom } from "effect/reactivity";

  class DiskFull extends Data.TaggedError("DiskFull") {}

  // Ticked by the "Fail the save" checkbox.
  const failAtom = Atom.make(false);

  // Saves draft number n after a second and a half, or fails with DiskFull.
  const saveAtom = Atom.fn((draft: number, get) =>
    Effect.gen(function* saveDraft() {
      yield* Effect.sleep("1500 millis");
      if (get(failAtom)) {
        return yield* new DiskFull();
      }
      return `draft ${draft}`;
    })
  );
</script>

<script lang="ts">
  import { Cause, Exit } from "effect";
  import { useAtom, useAtomSet, useAtomValue } from "effect-atom-svelte";
  import EventLog from "#lib/docs/kit/event-log.svelte";
  import { EventLogState } from "#lib/docs/kit/event-log.svelte.ts";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  const save = useAtomValue(saveAtom);
  const fail = useAtom(failAtom);
  const saveValue = useAtomSet(saveAtom);
  const savePromise = useAtomSet(saveAtom, { mode: "promise" });
  const saveExit = useAtomSet(saveAtom, { mode: "promiseExit" });

  const log = new EventLogState();
  let draft = 0;

  const withValue = () => {
    draft += 1;
    saveValue(draft);
    log.add(`value #${draft}: returned undefined`);
  };

  const withPromise = async () => {
    draft += 1;
    const n = draft;
    try {
      const saved = await savePromise(n);
      log.add(`promise #${n}: resolved with "${saved}"`, { tone: "success" });
    } catch (error) {
      // The typed error itself, or an Error when the call was interrupted.
      const reason = error instanceof DiskFull ? "DiskFull" : "interrupted";
      log.add(`promise #${n}: rejected, ${reason}`, { tone: "failure" });
    }
  };

  const withExit = async () => {
    draft += 1;
    const n = draft;
    const exit = await saveExit(n);
    if (Exit.isSuccess(exit)) {
      log.add(`promiseExit #${n}: Exit.Success("${exit.value}")`, { tone: "success" });
    } else {
      const reason = Cause.hasInterruptsOnly(exit.cause) ? "interrupted" : "DiskFull";
      log.add(`promiseExit #${n}: Exit.Failure, ${reason}`, { tone: "failure" });
    }
  };
</script>

<p class="flex flex-wrap items-center gap-2">
  <button onclick={withValue}>Save (value)</button>
  <button onclick={withPromise}>Save (promise)</button>
  <button onclick={withExit}>Save (promiseExit)</button>
</p>
<p class="flex flex-wrap items-center gap-2">
  <button
    data-cue="interrupt"
    disabled={!save.current.waiting}
    onclick={() => saveValue(Atom.Interrupt)}>Cancel</button
  >
  <button data-cue="reset" onclick={() => saveValue(Atom.Reset)}>Reset</button>
  <label><input bind:checked={fail.current} type="checkbox" /> Fail the save</label>
  <StateBadge data-testid="modes-state" result={save.current} />
</p>
<EventLog
  data-testid="modes-log"
  empty="Nothing saved yet."
  entries={log.entries}
  label="What each call gave back"
  max={8}
/>
