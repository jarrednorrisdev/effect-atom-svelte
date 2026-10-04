<script module lang="ts">
  import { Cause, Effect } from "effect";
  import { Atom } from "effect/reactivity";
  import { EventLogState } from "#lib/docs/kit/event-log.svelte.ts";

  // What the pretend server saw, for the log under the example.
  const server = new EventLogState();

  // A pretend slow API, like fetch: it answers after 2 seconds, and gives up
  // early if its AbortSignal is aborted.
  const slowRequest = (signal: AbortSignal) => {
    const { promise, reject, resolve } = Promise.withResolvers<string>();
    server.clear();
    server.add("request received", { tone: "running" });
    const timer = setTimeout(() => {
      server.add("response sent", { tone: "success" });
      resolve("Here is your data");
    }, 2000);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      server.add("signal aborted, request dropped", { tone: "interrupted" });
      reject(signal.reason);
    });
    return promise;
  };

  // tryPromise passes the request a signal, and aborts it if the effect is
  // interrupted. Atom.fn runs the effect each time it is called.
  const requestAtom = Atom.fn(() =>
    Effect.tryPromise((signal) => slowRequest(signal))
  );
</script>

<script lang="ts">
  import { useAtomSet, useAtomValue } from "effect-atom-svelte";
  import EventLog from "#lib/docs/kit/event-log.svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";
  import RunControls from "#lib/docs/kit/run-controls.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  const request = useAtomValue(requestAtom);
  const send = useAtomSet(requestAtom);
</script>

<p>
  <RunControls
    oninterrupt={() => send(Atom.Interrupt)}
    onrun={() => send()}
    running={request.current.waiting}
    runLabel="Send request"
  />
</p>
<div class="flex flex-wrap items-center gap-3">
  {#if request.current._tag === "Success"}
    <ResultChip kind="message" label="requestAtom" tone="success">
      <span data-testid="request">{request.current.value}</span>
    </ResultChip>
  {:else if request.current._tag === "Failure"}
    <!-- Interrupting leaves a Cause with no typed error, only an interruption. -->
    {@const interrupted = Cause.hasInterruptsOnly(request.current.cause)}
    <ResultChip
      kind="message"
      label="requestAtom"
      tone={interrupted ? "interrupted" : "failure"}
    >
      <span data-testid="request">
        {interrupted ? "Interrupted" : Cause.pretty(request.current.cause)}
      </span>
    </ResultChip>
  {:else if request.current.waiting}
    <ResultChip kind="message" label="requestAtom" tone="running">
      Waiting…
    </ResultChip>
  {:else}
    <ResultChip kind="message" label="requestAtom" tone="idle">Not sent</ResultChip>
  {/if}
  <StateBadge data-testid="request-state" result={request.current} />
</div>
<EventLog empty="No requests yet." entries={server.entries} label="Server" />
