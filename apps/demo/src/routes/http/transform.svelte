<script module lang="ts">
  import { DemoApi } from "@demo/domain";
  import { Effect } from "effect";
  import { HttpClient, HttpClientRequest } from "effect/http";
  import type { HttpClientResponse } from "effect/http";
  import { AtomHttpApi } from "effect/reactivity";
  import { EventLogState } from "#lib/docs/kit/event-log.svelte.ts";

  import { baseUrl, httpClient } from "#lib/clients.ts";

  // What the client sent and got back, for the log under the example.
  const wire = new EventLogState();

  const logRequest = ({ headers, method, url }: HttpClientRequest.HttpClientRequest) =>
    Effect.sync(() => {
      const path = new URL(url, location.href).pathname;
      const header = `x-reader: ${headers["x-reader"]}`;
      wire.add(`${method} ${path}, ${header}`, { tone: "running" });
    });

  const logResponse = ({ status }: HttpClientResponse.HttpClientResponse) =>
    Effect.sync(() => {
      wire.add(`${status}`, { tone: status < 400 ? "success" : "failure" });
    });

  class SignedHttp extends AtomHttpApi.Service<SignedHttp>()("docs/SignedHttp", {
    api: DemoApi,
    baseUrl,
    httpClient,
    // Wraps every request the client sends: add a header, such as a token, and log.
    transformClient: (client) =>
      client.pipe(
        HttpClient.mapRequest(HttpClientRequest.setHeader("x-reader", "docs")),
        HttpClient.tapRequest(logRequest),
        HttpClient.tap(logResponse)
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
  import { Option } from "effect";
  import { AsyncResult } from "effect/reactivity";
  import { useAtomSet, useAtomValue } from "effect-atom-svelte";
  import EventLog from "#lib/docs/kit/event-log.svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  const todo = useAtomValue(getTodoAtom);
  const getTodo = useAtomSet(getTodoAtom);

  const describe = (result: AsyncResult.AsyncResult<unknown, { _tag: string }>) =>
    Option.match(AsyncResult.error(result), {
      onNone: () => "Something went wrong.",
      onSome: (error) => `Failed with ${error._tag}`,
    });
</script>

<p class="flex flex-wrap gap-2">
  <button data-cue="start" onclick={() => getTodo(1)}>Get todo 1</button>
  <button data-cue="start" onclick={() => getTodo(99)}>Get todo 99</button>
</p>
<div class="flex flex-wrap items-center gap-3">
  {#if todo.current._tag === "Success"}
    <ResultChip kind="message" label="getTodoAtom" tone="success">
      <span data-testid="signed-todo">{todo.current.value.title}</span>
    </ResultChip>
  {:else if todo.current._tag === "Failure"}
    <ResultChip kind="message" label="getTodoAtom" tone="failure">
      <span data-testid="signed-todo">{describe(todo.current)}</span>
    </ResultChip>
  {/if}
  <StateBadge data-testid="signed-state" result={todo.current} />
</div>
<EventLog
  data-testid="signed-log"
  empty="Get a todo to see the request."
  entries={wire.entries}
  label="Requests"
/>
