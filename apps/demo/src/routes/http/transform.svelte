<script module lang="ts">
  import { DemoApi } from "@demo/domain";
  import { Effect } from "effect";
  import { HttpClient, HttpClientRequest } from "effect/http";
  import { AtomHttpApi } from "effect/reactivity";

  import { baseUrl } from "#lib/clients.ts";

  // The demo's HTTP client, which also logs each request for the panel below.
  import { loggedHttpClient, wire } from "./logged-client.ts";

  class SignedHttp extends AtomHttpApi.Service<SignedHttp>()("docs/SignedHttp", {
    api: DemoApi,
    baseUrl,
    httpClient: loggedHttpClient,
    // Changes every request the client sends: here, adds a header.
    transformClient: HttpClient.mapRequest(
      HttpClientRequest.setHeader("x-reader", "docs")
    ),
  }) {}

  // The service is also the HttpApi client, with a method for each endpoint.
  const getTodoAtom = SignedHttp.runtime.fn((id: number) =>
    Effect.gen(function* fetchTodo() {
      const client = yield* SignedHttp;
      return yield* client.todos.get({ params: { id } });
    })
  );
</script>

<script lang="ts">
  import { useAtomSet, useAtomValue } from "effect-atom-svelte";
  import CauseView from "#lib/docs/kit/cause-view.svelte";
  import EventLog from "#lib/docs/kit/event-log.svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  const todo = useAtomValue(getTodoAtom);
  const getTodo = useAtomSet(getTodoAtom);
</script>

<p class="flex flex-wrap items-center gap-2">
  <button data-cue="start" onclick={() => getTodo(1)}>Get todo 1</button>
  <button data-cue="start" onclick={() => getTodo(99)}>Get todo 99</button>
  <StateBadge data-testid="signed-state" result={todo.current} />
</p>
{#if todo.current._tag === "Success"}
  <ResultChip kind="message" label="getTodoAtom" tone="success">
    <span data-testid="signed-todo">{todo.current.value.title}</span>
  </ResultChip>
{:else if todo.current._tag === "Failure"}
  <!-- The 404 arrives as the endpoint's typed TodoNotFound. -->
  <CauseView cause={todo.current.cause} data-testid="signed-todo" />
{/if}
<EventLog
  data-testid="signed-log"
  empty="Get a todo to see the request."
  entries={wire.entries}
  label="Requests"
/>
