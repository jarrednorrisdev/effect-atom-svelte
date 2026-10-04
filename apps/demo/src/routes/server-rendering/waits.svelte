<script module lang="ts">
  import { Effect, Schema } from "effect";
  import { AsyncResult, Atom } from "effect/reactivity";

  import { browser } from "$app/env";

  // Records where it ran, half a second later, as a request would.
  const whereAtom = (key: string) =>
    Atom.make(
      Effect.sync((): string => (browser ? "browser" : "server")).pipe(
        Effect.delay("500 millis")
      )
    ).pipe(
      Atom.serializable({ key, schema: AsyncResult.Schema({ success: Schema.String }) })
    );

  const scriptAtom = whereAtom("waits-script");
  const markupAtom = whereAtom("waits-markup");
  const laterAtom = whereAtom("waits-later");
  const valueAtom = whereAtom("waits-value");
</script>

<script lang="ts">
  import { useAtomResult, useAtomSuspense, useAtomValue } from "effect-atom-svelte";
  import Origin from "#lib/docs/kit/origin.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";
  // A row: how the atom is read, what the server's HTML says, and what's there now.
  import ServerRow from "#lib/docs/kit/server-row.svelte";
  // Calls useAtomSuspense(atom) for the atom it is given, inside the boundary below.
  import Later from "./later.svelte";

  const markup = useAtomSuspense(markupAtom);
  const script = await useAtomResult(scriptAtom);
  // Read after the await, so the server renders it before it has a result.
  const value = useAtomValue(valueAtom);
</script>

<ServerRow id="waits-script" read="await useAtomResult">
  {#if script.current._tag === "Success"}
    <Origin where={script.current.value} />
  {/if}
</ServerRow>
<ServerRow id="waits-markup" read="{'{await}'} with no pending">
  <Origin where={await markup.current} />
</ServerRow>
<ServerRow id="waits-later" read="inside a pending boundary">
  <svelte:boundary>
    <Later atom={laterAtom} />
    {#snippet pending()}
      <span class="text-sm text-muted-foreground">Pending snippet</span>
    {/snippet}
  </svelte:boundary>
</ServerRow>
<ServerRow id="waits-value" read="useAtomValue">
  {#if value.current._tag === "Success"}
    <Origin where={value.current.value} />
  {:else}
    <StateBadge result={value.current} />
  {/if}
</ServerRow>
<p><button onclick={() => location.reload()}>Reload the page</button></p>
