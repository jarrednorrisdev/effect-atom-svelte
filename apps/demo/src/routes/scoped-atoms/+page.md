---
title: Scoped atoms
description: Give each part of the page its own atom, without passing it down by hand.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import Panels from "./panels.svelte";
  import panelsSource from "./panels.svelte?highlight";
  import scopeSource from "./counter-scope.ts?highlight";
  import counterSource from "./scoped-counter.svelte?highlight";
  import buttonSource from "./scoped-counter-button.svelte?highlight";
</script>

An atom defined at module level is one atom for the whole app. Sometimes each instance of a widget needs its own, such as a counter per panel or a draft per open dialog, and the components inside that widget need to find it. A **scoped atom** is created by the component that provides it, and every component below that one reads the same atom.

Each panel below provides its own counter. Both buttons in a panel share it, and the two panels don't affect each other:

<Example files={[{ html: scopeSource, name: "counter-scope.ts" }, { html: counterSource, name: "scoped-counter.svelte" }, { html: buttonSource, name: "scoped-counter-button.svelte" }, { html: panelsSource, name: "panels.svelte" }]}> <Panels /> </Example>

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

If a component is inside more than one provider, `use` returns the nearest one's atom.

<Aside type="caution">

`use` throws if no component above it called `provide`. Like any Svelte context, both must run while the component initialises, at the top level of its script.

</Aside>

## Scoped atoms or families?

Both give you more than one atom from one definition. Choose by where the atom belongs:

- A [family](/families) is keyed by a value. Any component can ask for `todoAtom(1)` and gets the same atom wherever it asks.
- A scoped atom is keyed by its place in the component tree. Only components below the provider can reach it, and two providers make two atoms even with the same input.

Either way, the atom's value lives in the registry, and the usual [lifetimes](/lifetimes) apply.
