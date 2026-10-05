<script module lang="ts">
  import { Atom } from "effect/reactivity";

  interface Key {
    readonly doc: number;
    readonly lang: string;
  }

  // keepAlive, so a draft outlives the moment you switch away from it
  // (see Keeping a family's atoms, below).
  const newDraft = () => Atom.make("").pipe(Atom.keepAlive);

  // The family compares keys by their contents.
  const draftAtom = Atom.family((key: Key) => newDraft());

  // A hand-rolled cache: a Map compares object keys by reference.
  const byMap = new Map<Key, Atom.Writable<string>>();
  const mapDraftAtom = (key: Key) => {
    const cached = byMap.get(key);
    if (cached) {
      return cached;
    }
    const atom = newDraft();
    byMap.set(key, atom);
    return atom;
  };
</script>

<script lang="ts">
  import { useAtom } from "effect-atom-svelte";
  import FlashValue from "#lib/docs/kit/flash-value.svelte";
  import Part from "#lib/docs/kit/part.svelte";
  import { SvelteSet } from "svelte/reactivity";

  let doc = $state(1);
  let lang = $state("en");
  // A new key object every time the document or the language changes.
  const key = $derived({ doc, lang });

  const stores = [
    { draft: useAtom(() => draftAtom(key)), get: draftAtom, id: "family", name: "Atom.family" },
    { draft: useAtom(() => mapDraftAtom(key)), get: mapDraftAtom, id: "map", name: "new Map()" },
  ];

  // The different keys visited, and the different atoms each store has handed out for them.
  const keys = new SvelteSet<string>();
  const made = stores.map(() => new SvelteSet<Atom.Atom<string>>());
  $effect(() => {
    keys.add(`${key.doc} ${key.lang}`);
    for (const [index, store] of stores.entries()) {
      made[index]?.add(store.get(key));
    }
  });
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
<p class="text-sm text-muted-foreground">
  Key: <code>&#123; doc: {key.doc}, lang: "{key.lang}" &#125;</code>
</p>
<div class="grid gap-3 sm:grid-cols-2">
  {#each stores as { draft, id, name }, index (id)}
    {@const atoms = made[index]?.size ?? 0}
    <!-- More atoms than keys: some key's earlier atom is still stored, but nothing can reach it. -->
    <Part code label={name} tone={atoms > keys.size ? "failure" : "idle"}>
      <textarea
        aria-label="{name} draft"
        bind:value={draft.current}
        class="h-20 w-full resize-none"
        placeholder="Type a draft"
      ></textarea>
      <p class="mt-2 mb-0 text-sm" data-testid="made-{id}">
        <FlashValue
          class={[atoms > keys.size && "text-(--tone-failure-text)"]}
          value={atoms}
        />
        {atoms === 1 ? "atom" : "atoms"} for
        <FlashValue value={keys.size} />
        {keys.size === 1 ? "key" : "keys"}
      </p>
    </Part>
  {/each}
</div>
