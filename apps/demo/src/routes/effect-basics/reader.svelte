<script module lang="ts">
  import { Effect } from "effect";
  import { Atom } from "effect/reactivity";
  import { EventLogState } from "#lib/docs/kit/event-log.svelte.ts";

  // What the pretend server saw, for the log under the example.
  export const server = new EventLogState();

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
  // interrupted: here, when nothing reads the atom any more.
  const requestAtom = Atom.make(
    Effect.tryPromise((signal) => slowRequest(signal))
  );
</script>

<script lang="ts">
  import { useAtomValue } from "effect-atom-svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  const request = useAtomValue(requestAtom);
</script>

<p class="m-0 flex flex-wrap items-baseline gap-3">
  {#if request.current._tag === "Success"}
    <ResultChip kind="message" label="requestAtom" tone="success">
      <span data-testid="request">{request.current.value}</span>
    </ResultChip>
  {:else}
    <ResultChip
      duration={2000}
      kind="message"
      label="requestAtom"
      tone="running"
    >
      Waiting…
    </ResultChip>
  {/if}
  <StateBadge data-testid="request-state" result={request.current} />
</p>
