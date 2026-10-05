<script module lang="ts">
  import { Effect, Schema } from "effect";
  import { AsyncResult, Atom } from "effect/reactivity";

  import { browser } from "$app/env";

  // Two atoms that record where they ran, each sent with the page.
  const whereAtom = (key: string) =>
    Atom.make(
      Effect.sync((): string => (browser ? "browser" : "server")).pipe(
        Effect.delay("800 millis")
      )
    ).pipe(
      Atom.serializable({ key, schema: AsyncResult.Schema({ success: Schema.String }) })
    );

  const keptAtom = whereAtom("revalidate-kept");
  const freshAtom = whereAtom("revalidate-fresh");
</script>

<script lang="ts">
  import { useAtomResult } from "effect-atom-svelte";
  // Each atom's result and history, side by side.
  import RevalidateParts from "./revalidate-parts.svelte";

  // Keeps the server's result.
  const kept = await useAtomResult(keptAtom);
  // Runs again in the browser. It hydrates with the server's result, marked as waiting, then
  // switches to the browser's.
  const fresh = await useAtomResult(freshAtom, { revalidateOnHydrate: true });
</script>

<RevalidateParts fresh={fresh.current} kept={kept.current} />
<p><button onclick={() => location.reload()}>Reload the page</button></p>
