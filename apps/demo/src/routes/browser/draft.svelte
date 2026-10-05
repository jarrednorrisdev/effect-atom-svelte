<script module lang="ts">
  import { Schema } from "effect";
  import { KeyValueStore } from "effect/persistence";
  import { Atom } from "effect/reactivity";

  import { browser } from "$app/env";

  // localStorage only exists in the browser. The server gets an in-memory store, so it
  // renders the default value.
  const storage = Atom.runtime(
    browser
      ? KeyValueStore.layerStorage(() => localStorage)
      : KeyValueStore.layerMemory
  );

  const draftAtom = Atom.kvs({
    defaultValue: () => "",
    key: "demo-draft",
    runtime: storage,
    schema: Schema.String,
  });
</script>

<script lang="ts">
  import { useAtom } from "effect-atom-svelte";
  import FlashValue from "#lib/docs/kit/flash-value.svelte";
  // What the server's HTML had in the same place.
  import ServerHtml from "#lib/docs/kit/server-html.svelte";

  const draft = useAtom(draftAtom);
</script>

<textarea bind:value={draft.current} data-testid="draft" placeholder="Type, then reload"
></textarea>
<p class="flex flex-wrap items-center gap-2">
  Saved draft: <FlashValue data-testid="draft-saved" value={draft.current} />
  <ServerHtml of="draft-saved" />
</p>
<p>
  <button data-cue="none" onclick={() => location.reload()}>Reload the page</button>
</p>
