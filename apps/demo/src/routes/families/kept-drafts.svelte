<script module lang="ts">
  import { Atom } from "effect/reactivity";

  interface Key {
    readonly doc: number;
    readonly lang: string;
  }

  // The drafts from the example above, in three families
  // that differ only in how long they keep an unread atom.
  const plainAtom = Atom.family((key: Key) => Atom.make(""));
  const idleAtom = Atom.family((key: Key) =>
    Atom.make("").pipe(Atom.setIdleTTL("5 seconds"))
  );
  const keptAtom = Atom.family((key: Key) => Atom.make("").pipe(Atom.keepAlive));

  const families = [
    { family: plainAtom, id: "plain", name: "plain", ttl: 0 },
    { family: idleAtom, id: "idle", name: 'setIdleTTL("5 seconds")', ttl: 5000 },
    { family: keptAtom, id: "kept", name: "keepAlive", ttl: Number.POSITIVE_INFINITY },
  ];
</script>

<script lang="ts">
  import { useAtom } from "effect-atom-svelte";
  import Part from "#lib/docs/kit/part.svelte";

  import KeyStates from "./key-states.svelte";

  let doc = $state(1);
  let lang = $state("en");
  const key = $derived({ doc, lang });

  // Each editor reads only the current key's draft, so the key you leave has no reader.
  const editors = families.map((entry) => ({
    ...entry,
    draft: useAtom(() => entry.family(key)),
  }));
</script>

<p>
  <span class="button-group">
    {#each [1, 2] as value (value)}
      <button aria-pressed={doc === value} onclick={() => (doc = value)}>doc: {value}</button>
    {/each}
  </span>
  <span class="button-group">
    {#each ["en", "fr"] as value (value)}
      <button aria-pressed={lang === value} onclick={() => (lang = value)}>lang: "{value}"</button>
    {/each}
  </span>
</p>
<div class="grid gap-3 md:grid-cols-3">
  {#each editors as { draft, family, id, name, ttl } (id)}
    <Part code label={name}>
      <input
        aria-label="{name} draft"
        bind:value={draft.current}
        class="w-full"
        placeholder="Type a draft"
      />
      <KeyStates current={key} data-testid="states-{id}" {family} {ttl} />
    </Part>
  {/each}
</div>
