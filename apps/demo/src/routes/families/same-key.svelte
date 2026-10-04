<script module lang="ts">
  import { Atom } from "effect/reactivity";

  interface Key {
    readonly doc: number;
    readonly lang: string;
  }

  let recipeRuns = 0;

  const draftAtom = Atom.family((key: Key) => {
    recipeRuns += 1;
    return Atom.make(`Doc ${key.doc} in ${key.lang}`);
  });
</script>

<script lang="ts">
  import Slots from "#lib/docs/kit/slots.svelte";

  interface Call {
    readonly atom: Atom.Atom<string>;
    readonly key: Key;
    readonly ran: boolean;
  }

  let doc = $state(1);
  let lang = $state("en");
  // Every call so far, with the atom it returned.
  let calls = $state.raw<readonly Call[]>([]);

  const call = () => {
    const before = recipeRuns;
    // A new key object on every click.
    const atom = draftAtom({ doc, lang });
    calls = [...calls, { atom, key: { doc, lang }, ran: recipeRuns > before }];
  };

  const firstCall = (atom: Atom.Atom<string>) =>
    calls.findIndex((earlier) => earlier.atom === atom) + 1;
  // The last five calls, numbered from the first.
  const first = $derived(Math.max(0, calls.length - 5));
  const made = $derived([
    ...new Set(calls.map(({ key }) => `${key.doc} ${key.lang}`)),
  ]);
</script>

<p>
  <select aria-label="Document" bind:value={doc} data-testid="key-doc">
    <option value={1}>doc: 1</option>
    <option value={2}>doc: 2</option>
  </select>
  <select aria-label="Language" bind:value={lang} data-testid="key-lang">
    <option value="en">lang: "en"</option>
    <option value="fr">lang: "fr"</option>
  </select>
  <button onclick={call}>Call draftAtom</button>
</p>
<ol aria-label="Calls" class="my-2 list-decimal pl-6 text-sm" start={first + 1}>
  {#each calls.slice(first) as { atom, key, ran }, offset (first + offset)}
    <li>
      <code>draftAtom(&#123; doc: {key.doc}, lang: "{key.lang}" &#125;)</code>
      {#if ran}
        <strong class="text-(--tone-success-text)">new atom: the recipe ran</strong>
      {:else if firstCall(atom) <= first + offset}
        same atom as call {firstCall(atom)}
      {:else}
        the atom the family already had
      {/if}
    </li>
  {/each}
</ol>
<Slots capacity={4} data-testid="key-atoms" items={made} label="keys called" />
