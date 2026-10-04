---
title: AtomRef
description: A reactive value you can read and update by property, without a registry.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import Profile from "./profile.svelte";
  import profileSource from "./profile.svelte?highlight";
</script>

An `AtomRef` holds a reactive value itself, with no registry. It runs no effects and is never disposed: you create it, read it, and set it. It suits plain local data that several components edit, such as a form draft or a document in an editor, where you want to read and update single properties.

<Example files={[{ html: profileSource, name: "profile.svelte" }]}> <Profile /> </Example>

## AtomRef or `$state`

Svelte's `$state` covers much of this: a `$state` object is deeply reactive, and changing one property updates only what reads it. In an app where only Svelte components touch the data, `$state` is simpler. `AtomRef` is worth it when:

- **Code outside Svelte owns the value.** A ref is plain TypeScript with no runes, so a model shared with React or Vue code can hold refs that each framework reads through its own Effect Atom adapter.
- **Equal values shouldn't notify.** A ref compares values structurally, as described below, so setting an equal copy wakes nobody. `$state` treats a new object as a change.
- **A child should edit one property.** `prop` hands a child a ref it can read and set without knowing the shape of the parent value.

## Creating and updating a ref

`AtomRef.make` takes the starting value:

```ts
import { AtomRef } from "effect/reactivity";

const profile = AtomRef.make({ name: "Ada", role: "Engineer" });

profile.value; // { name: "Ada", role: "Engineer" }
profile.set({ name: "Grace", role: "Admiral" });
profile.update((current) => ({ ...current, role: "Rear admiral" }));
```

A ref compares the new value with the current one using Effect's structural equality. Setting a value equal to the current one, even as a different object, changes nothing and notifies nobody.

### Properties

`prop` returns a ref for one property. Setting it replaces the parent's value with a copy that has the new property, so the parent and every other reader see the change:

```ts
const name = profile.prop("name");

name.set("Grace Hopper"); // profile.value.name is now "Grace Hopper"
```

Property refs nest, `profile.prop("address").prop("city")`, and work on arrays by index.

### Derived refs

`map` returns a read-only ref computed from another, which notifies only when its own result changes:

```ts
const badge = profile.map(({ name, role }) => `${name} · ${role}`);
```

## Reading a ref in a component

| Hook | Returns |
| --- | --- |
| `useAtomRef(ref)` | The ref's value as `current`. Works with any ref, including `map`'s. |
| `useAtomRefPropValue(ref, "name")` | One property's value as `current`. It updates only when that property changes. |
| `useAtomRefProp(ref, "name")` | The property's own ref, to pass to a child or to `set`. |

Like the atom hooks, `useAtomRef` and `useAtomRefPropValue` take a getter, `() => ref`, to follow a different ref when state changes. To write, call `set` or `update` on the ref.

## Lists of refs

`AtomRef.collection` holds a list in which each item is its own ref. Change one item, and readers of that item and of the list update. `push`, `insertAt` and `remove` change the list itself:

```ts
const todos = AtomRef.collection([{ done: false, title: "Write the docs" }]);

todos.push({ done: false, title: "Ship it" });
todos.value[0]?.prop("done").set(true);
```

<Aside type="danger" title="Module-level refs are shared on the server">

A ref has no registry, so it gets none of the [per-request isolation](/server-rendering#one-registry-per-request) atoms get. A ref created at module level is shared by every request the server handles. Create refs that hold per-user data inside a component, and pass them down, or only write to them in the browser.

</Aside>

To give each part of the page its own atom instead, see [Scoped atoms](/scoped-atoms).
