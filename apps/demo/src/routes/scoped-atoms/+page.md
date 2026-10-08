---
title: Scoped atoms
description: Give each part of the page its own atom, without passing it down by hand.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import NestedEditors from "./nested-editors.svelte";
  import nestedSource from "./nested-editors.svelte?highlight";
  import draftScopeSource from "./draft-scope.ts?highlight";
  import Editors from "./editors.svelte";
  import editorsSource from "./editors.svelte?highlight";
  import noteEditorSource from "./note-editor.svelte?highlight";
  import previewSource from "./preview.svelte?highlight";
  import sharedEditorSource from "./shared-editor.svelte?highlight";
  import textFieldSource from "./text-field.svelte?highlight";
  import toolbarSource from "./toolbar.svelte?highlight";
</script>

An atom defined at module level is one atom for the whole app. Sometimes each instance of a widget needs its own, such as a draft per open editor, and the components inside that widget need to find it. A **scoped atom** is created by the component that provides it, and every component below that one reads the same atom.

Below, each note editor provides its own draft. Its toolbar, text area and preview are separate components that take no props: each finds the editor's draft with `Draft.use()`. Switch to **One draft for both** to provide a single draft above both editors instead, with editors that provide none. Every part then finds that one, as they would find an atom defined at module level, and you can see what the scope prevents:

<Example files={[{ html: draftScopeSource, name: "draft-scope.ts" }, { html: editorsSource, name: "editors.svelte" }, { html: noteEditorSource, name: "note-editor.svelte" }, { html: toolbarSource, name: "toolbar.svelte" }, { html: textFieldSource, name: "text-field.svelte" }, { html: previewSource, name: "preview.svelte" }, { html: sharedEditorSource, name: "shared-editor.svelte" }]} hint="Write in Note A: its word count and preview follow, and Note B stays empty. Then click One draft for both and write again: each change shows in both editors."> <Editors /> </Example>

## Defining a scoped atom

`ScopedAtom.make` takes a function that builds the atom. It can take an input, which the providing component passes in:

```ts
import { ScopedAtom } from "effect-atom-svelte";
import { Atom } from "effect/reactivity";

export const Draft = ScopedAtom.make((initial: string) => Atom.make(initial));
```

## Providing and using it

Call `provide` in the component that owns the atom. It runs the function once for that component, puts the atom in Svelte's context, and returns it:

```svelte
<script lang="ts">
  const { initial } = $props();
  // svelte-ignore state_referenced_locally
  const draft = Draft.provide(initial);
  useAtomMount(draft);
</script>
```

The function runs once, so `provide` reads its input once: a later change to `initial` doesn't make a new atom. The `svelte-ignore` comment says that reading the prop once is intended.

`provide` only puts the atom in context; it doesn't hold it. If every component below that reads the atom unmounts, the registry disposes of it, and the next reader starts from the initial value. `useAtomMount` in the providing component holds it for as long as that component lives. `Atom.keepAlive` in the function would hold it too, but for as long as the registry lives, long after the component has gone. See [Lifetimes](/lifetimes).

Call `use` in any component below it to get the same atom, then read it with the usual hooks:

```svelte
<script lang="ts">
  const draft = useAtom(Draft.use());
</script>
```

If a component is inside more than one provider, `use` returns the nearest one's atom. Below, the same note editor is nested, as a reply inside a post, and both provide `Draft`. Each part's label names the editor whose draft it got:

<Example files={[{ html: nestedSource, name: "nested-editors.svelte" }, { html: noteEditorSource, name: "note-editor.svelte" }, { html: draftScopeSource, name: "draft-scope.ts" }]} hint="Write in the post, then in the reply: every part calls the same Draft.use(), but the reply's parts get the reply's draft, so the two never mix."> <NestedEditors /> </Example>

<Aside type="caution" title="use needs a provider above it">

`use` throws if no component above it called `provide`. Like any Svelte context, both must run while the component initializes, at the top level of its script. Give `make` a name, as in `ScopedAtom.make(f, { name: "Draft" })`, and the error says which scoped atom it was.

</Aside>

## Scoped atoms or families?

Both give you more than one atom from one definition. Choose by where the atom belongs:

- A [family](/families) is keyed by a value. Any component can ask for `todoAtom(1)` and gets the same atom wherever it asks.
- A scoped atom is keyed by its place in the component tree. Only components below the provider can reach it, and two providers make two atoms even with the same input, as the nested editors above show.

Either way, the atom's value lives in the registry, and the usual [lifetimes](/lifetimes) apply.

A scoped atom can't take a fixed serialization key. Every provider makes its own atom, so two providers on one page would share the key, and the async hooks throw `Two different atoms share the serialization key`. If you need one, put the input in the key. Without a key, a scoped atom's value isn't sent from the server to the browser: see [Hydration](/hydration).
