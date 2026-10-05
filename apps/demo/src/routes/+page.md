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

<Aside type="caution" title="Pre-release community project">

effect-atom-svelte is not on npm yet, and its API may change before 0.1.0. It is a community project by Jarred Norris, not part of Effect, and the Effect team neither makes nor endorses it. Most of its code and these docs were written with the help of AI (Claude Opus 5.5); its behavior is covered by tests in Chromium, Firefox and WebKit.

</Aside>

effect-atom-svelte connects [Effect Atom](https://github.com/Effect-TS/effect/tree/main/packages/effect/src/reactivity) to Svelte 5 components.

Effect Atom (`effect/reactivity`) keeps your application's state in **atoms**: small reactive values that can hold plain data, be derived from other atoms, or run an `Effect` or a `Stream`. This library gives your components hooks to read and write those atoms, and the pieces you need to render them on the server and pick up where the server left off in the browser.

Its API follows the adapters the Effect team maintains, `@effect/atom-react` and `@effect/atom-vue`, but it is a separate project. If you have used atoms in React or Vue, you already know the atoms; only the hooks change.

effect-atom-svelte was inspired by Thomas Foster's [Svelte Atoms pull request](https://github.com/Effect-TS/effect-smol/pull/2443) to effect-smol. The design of the live examples in these docs is inspired by Kit Langton's [Visual Effect](https://effect.kitlangton.com/).

## A first look

Three atoms: a number you can change, a value derived from it, and an `Effect` that takes two seconds. The component reads all three with hooks. If `Effect` is new to you, [Effect basics](/effect-basics) covers what these docs use.

<Example files={[{ html: tasteSource, name: "taste.svelte" }]} hint="Click Add one: countAtom changes and doubledAtom follows. Click Load again: the old greeting stays until the new one arrives."> <Taste /> </Example>

Clicking **Add one** writes to `countAtom`, and `doubledAtom` follows. The greeting is awaited in the markup, with a `<svelte:boundary>` showing "Loading…" until the effect finishes. **Load again** runs `greetingAtom` again. The old greeting stays on screen, dimmed, until the new one arrives.

## How it fits together

Three pieces work together:

| Piece | What it is |
| --- | --- |
| **Atom** | A description of a value: a starting value, how to derive it from other atoms, or an `Effect` or `Stream` that produces it. An atom holds no value itself, so it is safe to define once in a module. |
| **Registry** | Where the values live. It computes an atom when something first reads it, computes it again when its inputs change, and disposes of it when nothing holds it any more, unless the atom is [kept alive](/lifetimes). On the server each request gets its own registry; in the browser one lasts for the session. |
| **Hook** | Connects a component to an atom in the nearest registry. It [holds](/reading-and-writing#reading) the atom while something reactive, such as markup or `$derived`, reads `current`, and lets go when nothing does. |

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

## How these docs work

Most pages have a live example. The code under each example is the file that runs on the page, so what you read is what you see working. Some examples talk to a small demo API that keeps a todo list and serves it over Effect `HttpApi` and Effect RPC. On this site, the demo API runs in your browser tab, so the todos you add last until you reload the page.
