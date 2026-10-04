---
title: Introduction
description: Community-built Svelte 5 bindings for Effect Atom.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import Taste from "./taste.svelte";
  import tasteSource from "./taste.svelte?highlight";
</script>

effect-atom-svelte connects [Effect Atom](https://github.com/Effect-TS/effect/tree/main/packages/effect/src/reactivity) to Svelte 5 components. It is a community project by Jarred Norris: it is not part of Effect, and the Effect team neither makes nor endorses it.

Effect Atom (`effect/reactivity`) keeps your application's state in **atoms**: small reactive values that can hold plain data, be derived from other atoms, or run an `Effect` or a `Stream`. This library gives your components hooks to read and write those atoms, and the pieces you need to render them on the server and pick up where the server left off in the browser.

Its API follows the adapters the Effect team maintains, `@effect/atom-react` and `@effect/atom-vue`, but it is a separate project. If you have used atoms in React or Vue, you already know the atoms; only the hooks change.

## A first look

Three atoms: a number you can change, a value derived from it, and an `Effect` that takes half a second. The component reads all three with hooks:

<Example files={[{ html: tasteSource, name: "taste.svelte" }]} hint="Click Add one: countAtom changes and doubledAtom follows. Reload the page to watch greetingAtom load."> <Taste /> </Example>

Clicking **Add one** writes to `countAtom`, and `doubledAtom` follows. The greeting is awaited in the markup, with a `<svelte:boundary>` showing "Loading…" until the effect finishes.

## How it fits together

Three pieces work together:

| Piece | What it is |
| --- | --- |
| **Atom** | A description of a value: a starting value, how to derive it from other atoms, or an `Effect` or `Stream` that produces it. An atom holds no value itself, so it is safe to define once in a module. |
| **Registry** | Where the values live. It computes an atom when something first reads it, computes it again when its inputs change, and disposes of it when nothing reads it any more. On the server each request gets its own registry; in the browser one lasts for the session. |
| **Hook** | Connects a component to an atom in the nearest registry. It subscribes while the component reads `current`, and unsubscribes when the component is destroyed. |

Because values live in the registry rather than in the atom, the same `countAtom` can hold a different number for each visitor the server renders for at the same time. [Why atoms](/why-atoms) explains why that matters, and when you don't need atoms at all.

## What you get

- **Hooks with a reactive `current`**, Svelte's convention for reactive values. Read it in markup, assign to it, or `bind:` to it.
- **Async atoms you can `await`**: `useAtomSuspense` and `useAtomResult` build on Svelte's experimental async support, so pending and failed states go through `<svelte:boundary>`.
- **Server rendering and hydration**: each request gets its own registry, and the results of serializable async atoms awaited on the server travel to the browser, which uses them instead of running the effects again.
- **Effect services in components**: `AtomRpc` and `AtomHttpApi` turn an Effect RPC group or `HttpApi` into atoms for queries and mutations.

## Requirements

- `effect` 4.0
- Svelte 5.57 or later, with experimental async turned on for the async hooks and server rendering
- SvelteKit 3, if you want the server rendering helpers shown in these docs

<Aside type="caution" title="Pre-release">

effect-atom-svelte is not on npm yet, and its API may change before 0.1.0.

</Aside>

## How these docs work

Most pages have a live example. The code under each example is the file that runs on the page, so what you read is what you see working. Some examples talk to a small demo API that keeps a todo list and serves it over Effect `HttpApi` and Effect RPC. On this site, the demo API runs in your browser tab, so the todos you add last until you reload the page.
