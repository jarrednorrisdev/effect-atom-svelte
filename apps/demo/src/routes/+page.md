---
title: Introduction
description: Svelte 5 bindings for Effect Atom.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
</script>

effect-atom-svelte connects [Effect Atom](https://effect.website) to Svelte 5 components.

Effect Atom (`effect/reactivity`) keeps your application's state in **atoms**: small reactive values that can hold plain data, be derived from other atoms, or run an `Effect` or a `Stream`. This library gives your components hooks to read and write those atoms, and the pieces you need to render them on the server and pick up where the server left off in the browser.

It follows the shape of Effect's official adapters, `@effect/atom-react` and `@effect/atom-vue`. If you have used atoms in React or Vue, you already know the atoms; only the hooks change.

## What you get

- **Hooks with a reactive `.current`**, Svelte's convention for reactive values. Read it in markup, assign to it, or `bind:` to it.
- **Async atoms you can `await`**: `useAtomSuspense` and `useAtomResult` build on Svelte's experimental async support, so pending and failed states go through `<svelte:boundary>`.
- **Server rendering and hydration**: each request gets its own registry, and values computed on the server travel to the browser, which uses them instead of fetching again.
- **Effect services in components**: `AtomRpc` and `AtomHttpApi` turn an Effect RPC group or `HttpApi` into atoms for queries and mutations.

## Requirements

- `effect` 4.0
- Svelte 5.57 or later, with experimental async turned on for the async hooks and server rendering
- SvelteKit 3, if you want the server rendering helpers shown in these docs

<Aside type="caution" title="Pre-release">

effect-atom-svelte is not on npm yet, and its API may change before 0.1.0.

</Aside>

## How these docs work

Most pages have a live example. The code under each example is the file that runs on the page, so what you read is what you see working. Some examples talk to a small demo API that serves a todo list over Effect `HttpApi` and Effect RPC.

Start with [Installation](/installation).
