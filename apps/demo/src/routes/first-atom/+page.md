---
title: Your first atom
description: Define an atom, read and write it from a component, and share it.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import Counters from "./counters.svelte";
  import countersSource from "./counters.svelte?highlight";
  import counterSource from "./counter.svelte?highlight";
</script>

This page builds a counter. Two components show it, and clicking either one updates both, because they read the same atom.

<Example files={[{ html: counterSource, name: "counter.svelte" }, { html: countersSource, name: "counters.svelte" }]}> <Counters /> </Example>

## Define an atom

`Atom.make` with a plain value creates a **writable atom** that starts at that value:

```ts
import { Atom } from "effect/reactivity";

const countAtom = Atom.make(0);
```

The atom is only a description. Its value lives in the registry you set up in [Installation](/installation), so the same atom can have a different value in each registry: one per request on the server, one per session in the browser.

Define atoms once, outside your components. A plain `.ts` module works, and so does a component's `<script module>`, which runs once rather than once per instance. An atom created inside a component's `<script>` would be a new atom for every instance, each with its own value.

## Read and write it

`useAtom` connects a component to a writable atom. It returns an object whose `current` property is the atom's value:

```svelte
<script lang="ts">
  import { useAtom } from "effect-atom-svelte";

  const count = useAtom(countAtom);
</script>

<button onclick={() => (count.current += 1)}>{count.current}</button>
```

Reading `count.current` in the markup subscribes to the atom, so the button updates when the value changes. Assigning to `count.current` writes to the atom.

## Share it

Every component that reads `countAtom` from the same registry sees the same value. In the example above, `counters.svelte` renders `<Counter>` twice, and both instances read the atom defined in `counter.svelte`'s module script.

<Aside type="caution" title="Atoms nobody reads are reset">

When no component reads an atom, the registry disposes of its value, and the next read starts again from `Atom.make`'s initial value. Wrap the atom in `Atom.keepAlive` to keep its value for as long as the registry lives. [Lifetimes](/lifetimes) covers this in detail.

</Aside>
