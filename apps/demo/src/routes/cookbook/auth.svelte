<script module lang="ts">
  import { DEMO_TOKEN, DemoApi } from "@demo/domain";
  import { HttpClient, HttpClientRequest } from "effect/http";
  import { AtomHttpApi } from "effect/reactivity";

  import { baseUrl, httpClient } from "#lib/clients.ts";

  // The visitor's token, as your sign-in code would keep it. Only the
  // browser sets it.
  const session = $state({ token: "" });

  // mapRequest runs for each request, so each one carries the token of the
  // moment.
  class Authed extends AtomHttpApi.Service<Authed>()("demo/Authed", {
    api: DemoApi,
    baseUrl,
    httpClient,
    transformClient: HttpClient.mapRequest((request) =>
      session.token
        ? HttpClientRequest.bearerToken(request, session.token)
        : request
    ),
  }) {}

  // GET /api/me answers 401 Unauthorized without the header. Each write
  // sends one request.
  const meAtom = Authed.mutation("account", "me");
</script>

<script lang="ts">
  import type { Account } from "@demo/domain";
  import { Cause, Option } from "effect";
  import { useAtomSet, useAtomValue } from "effect-atom-svelte";
  import Part from "#lib/docs/kit/part.svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";
  import ResultHistory from "#lib/docs/kit/result-history.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  const me = useAtomValue(meAtom);
  const sendMe = useAtomSet(meAtom);
</script>

<p class="flex flex-wrap items-center gap-2">
  <label>
    <input
      checked={session.token !== ""}
      onchange={(event) => {
        session.token = event.currentTarget.checked ? DEMO_TOKEN : "";
      }}
      type="checkbox"
    />
    Signed in
  </label>
  <button disabled={me.current.waiting} onclick={() => sendMe({})}>
    GET /api/me
  </button>
  <StateBadge data-testid="auth-state" result={me.current} />
</p>
<div class="flex flex-wrap items-center gap-3">
  <Part code label="transformClient" tone={session.token ? "success" : "idle"}>
    <code data-testid="auth-header">
      {session.token ? `Authorization: Bearer ${session.token}` : "No header"}
    </code>
  </Part>
  {#if me.current._tag === "Success"}
    <ResultChip kind="message" label="200 OK" tone="success">
      <span data-testid="auth-result">
        Signed in as {me.current.value.name}
      </span>
    </ResultChip>
  {:else if me.current._tag === "Failure"}
    {@const error = Cause.findErrorOption(me.current.cause)}
    <!-- Unauthorized is the endpoint's typed error, a 401. -->
    {#if Option.isSome(error)}
      <ResultChip kind="message" label="401 Unauthorized" tone="failure">
        <span data-testid="auth-result">{error.value.message}</span>
      </ResultChip>
    {:else}
      <ResultChip kind="message" label="GET /api/me" tone="failure">
        <span data-testid="auth-result">The request failed.</span>
      </ResultChip>
    {/if}
  {/if}
</div>
<ResultHistory
  data-testid="auth-history"
  format={(account) => (account as Account).name}
  label="Responses"
  result={me.current}
/>
