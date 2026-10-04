---
title: Scoped atoms
description: Give each part of the page its own atom, without passing it down by hand.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import counterPanelSource from "./counter-panel.svelte?highlight";
  import NestedPanels from "./nested-panels.svelte";
  import nestedSource from "./nested-panels.svelte?highlight";
  import draftScopeSource from "./draft-scope.ts?highlight";
  import Editors from "./editors.svelte";
  import editorsSource from "./editors.svelte?highlight";
  import noteEditorSource from "./note-editor.svelte?highlight";
  import previewSource from "./preview.svelte?highlight";
  import textAreaSource from "./text-area.svelte?highlight";
  import toolbarSource from "./toolbar.svelte?highlight";
</script>

An atom defined at module level is one atom for the whole app. Sometimes each instance of a widget needs its own, such as a counter per panel or a draft per open dialog, and the components inside that widget need to find it. A **scoped atom** is created by the component that provides it, and every component below that one reads the same atom.

Below, each note editor provides its own draft. Its toolbar, text area and preview are separate components that take no props: each finds the editor's draft with `Draft.use()`. Switch to **Module atom** to give both editors one atom made at module level instead, and see what the scope prevents:

<Example files={[{ html: draftScopeSource, name: "draft-scope.ts" }, { html: editorsSource, name: "editors.svelte" }, { html: noteEditorSource, name: "note-editor.svelte" }, { html: toolbarSource, name: "toolbar.svelte" }, { html: textAreaSource, name: "text-area.svelte" }, { html: previewSource, name: "preview.svelte" }]} hint="Write in Note A: its word count and preview follow, and Note B stays empty. Then pick Module atom and write again: both editors share one draft, so each change shows in both."> <Editors /> </Example>

## Defining a scoped atom

`ScopedAtom.make` takes a function that builds the atom. It can take an input, which the providing component passes in:

```ts
import { ScopedAtom } from "effect-atom-svelte";
import { Atom } from "effect/reactivity";

export const Counter = ScopedAtom.make((start: number) => Atom.make(start));
```

## Providing and using it

Call `provide` in the component that owns the atom. It runs the function once for that component, puts the atom in Svelte's context, and returns it:

```svelte
<script lang="ts">
  const { start } = $props();
  Counter.provide(start);
</script>
```

Call `use` in any component below it to get the same atom, then read it with the usual hooks:

```svelte
<script lang="ts">
  const count = useAtom(Counter.use());
</script>
```

If a component is inside more than one provider, `use` returns the nearest one's atom. Below, the inner panel sits inside the outer one, and both provide `Counter` with the same input, `0`:

<Example files={[{ html: counterPanelSource, name: "counter-panel.svelte" }, { html: nestedSource, name: "nested-panels.svelte" }]} hint="Click +1 in the outer panel, then in the inner one: each button finds the nearest provider's atom, so the two counts move on their own."> <NestedPanels /> </Example>

<Aside type="caution" title="use needs a provider above it">

`use` throws if no component above it called `provide`. Like any Svelte context, both must run while the component initializes, at the top level of its script.

</Aside>

## Scoped atoms or families?

Both give you more than one atom from one definition. Choose by where the atom belongs:

- A [family](/families) is keyed by a value. Any component can ask for `todoAtom(1)` and gets the same atom wherever it asks.
- A scoped atom is keyed by its place in the component tree. Only components below the provider can reach it, and two providers make two atoms even with the same input, as the nested panels above show.

Either way, the atom's value lives in the registry, and the usual [lifetimes](/lifetimes) apply.
