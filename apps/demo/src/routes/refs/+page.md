---
title: AtomRef
description: A reactive value you can read and update by property, without a registry.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import Autosave from "./autosave.svelte";
  import autosaveSource from "./autosave.svelte?highlight";
  import cardSource from "./profile-card.svelte?highlight";
  import ProfileEditor from "./profile-editor.svelte";
  import editorSource from "./profile-editor.svelte?highlight";
  import fieldSource from "./profile-field.svelte?highlight";
  import apiSource from "./profile-api.ts?highlight";
  import todoItemSource from "./todo-item.svelte?highlight";
  import Todos from "./todos.svelte";
  import todosSource from "./todos.svelte?highlight";
</script>

An `AtomRef` holds a reactive value itself, with no registry. It runs no effects and is never disposed: you create it, read it, and set it.

It's built for one object that several components edit piece by piece, such as a form draft or a document in an editor. `prop` hands a component a writable slice of the value: one property, however deep. The component reads and sets its slice without knowing the shape of the whole, and everything that reads the whole value sees the change.

Below, the editor owns one profile ref. Each field gets a slice of it, and the card reads the whole thing:

<Example files={[{ html: editorSource, name: "profile-editor.svelte" }, { html: fieldSource, name: "profile-field.svelte" }, { html: cardSource, name: "profile-card.svelte" }]} hint="Edit any field: the card, which reads the whole profile, follows. City lives two levels deep, inside address, yet its field is the same component as Name's: setting it writes a new address into the profile."> <ProfileEditor /> </Example>

## AtomRef or `$state`

Svelte's `$state` covers much of this: a `$state` object is deeply reactive, and changing one property updates only what reads it. In an app where only Svelte components touch the data, `$state` is simpler. `AtomRef` is worth it when: With `$state`, you'd pass the whole object, or a getter and a setter.

- **Code outside Svelte owns the value.** A ref is plain TypeScript with no runes, so a model shared with React or Vue code can hold refs that each framework reads through its own Effect Atom adapter.
- **Equal values shouldn't notify.** A ref compares values structurally, as described below, so setting an equal copy wakes nobody. `$state` treats a new object as a change.

## Creating and updating a ref

`AtomRef.make` takes the starting value:

```ts
import { AtomRef } from "effect/reactivity";

const profile = AtomRef.make({ name: "Ada", role: "Engineer" });

profile.value; // { name: "Ada", role: "Engineer" }
profile.set({ name: "Grace", role: "Admiral" });
profile.update((current) => ({ ...current, role: "Rear admiral" }));
```

`subscribe` adds a listener that runs whenever the value changes, and returns a function that removes it.

### Equal values change nothing

A ref compares the new value with the current one using Effect's structural equality. Setting a value equal to the current one, even as a different object, changes nothing and notifies nobody.

That matters when code runs on every change. Below, a listener autosaves the draft half a second after each edit. The server answers with its own stored copy, a new object, and the form adopts it as the draft:

<Example files={[{ html: autosaveSource, name: "autosave.svelte" }, { html: apiSource, name: "profile-api.ts" }]} hint="Change the name to Ada Byron and pause: one request goes out. The server's answer equals the draft, so setting it notifies nobody and nothing saves again. Then type a name in lowercase: the server capitalizes it, that copy is a real change, so it saves once more and then stops."> <Autosave /> </Example>

If the ref compared objects by reference, every answer would count as a change: it would save again, get another new object back, and loop forever.

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

Below, each `<TodoItem>` gets its item's ref, and the numbers count notifications: the list's in the corner, each item's beside it.

<Example files={[{ html: todosSource, name: "todos.svelte" }, { html: todoItemSource, name: "todo-item.svelte" }]} hint="Tick a todo: its count and the list's go up, the other item's stays. Then add a todo or remove one: only the list is notified."> <Todos /> </Example>

<Aside type="danger" title="Module-level refs are shared on the server">

A ref has no registry, so it gets none of the [per-request isolation](/server-rendering#one-registry-per-request) atoms get. A ref created at module level is shared by every request the server handles. Create refs that hold per-user data inside a component, and pass them down, or only write to them in the browser.

</Aside>

To give each part of the page its own atom instead, see [Scoped atoms](/scoped-atoms).
