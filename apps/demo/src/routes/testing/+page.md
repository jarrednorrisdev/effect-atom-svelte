---
title: Testing
description: Test atoms against a registry of their own, render components with test state, and replace services with test layers.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import configSource from "../../../vitest.config.ts?highlight";
  import counterComponentTestSource from "./counter-component.test.ts?highlight";
  import counterSvelteSource from "./counter.svelte?highlight";
  import counterTestSource from "./counter.test.ts?highlight";
  import counterSource from "./counter.ts?highlight";
  import forecastTestSource from "./forecast.test.ts?highlight";
  import forecastSource from "./forecast.ts?highlight";
  import httpTestSource from "./http.test.ts?highlight";
  import rpcTestSource from "./rpc.test.ts?highlight";
</script>

An atom holds no state of its own: its value lives in a registry. So a test needs no setup to reset and nothing to mock for plain atoms. It makes a fresh registry, writes what it needs, and reads the result. Services work the same way, with one more step: you give the registry a test layer in place of the real one.

The examples on this page are this site's own tests. CI runs them with [Vitest](https://vitest.dev) in browser mode and [vitest-browser-svelte](https://github.com/vitest-community/vitest-browser-svelte), so the code you see here is the code that passes.

## Setting up

Atom tests that only use a registry run anywhere Vitest does. Component tests need a browser, which Vitest's browser mode provides through Playwright:

```bash
bun add -D vitest @vitest/browser-playwright playwright vitest-browser-svelte
```

Vitest needs the Svelte plugin to compile your components. Turn on Svelte's async mode there if your components use `await`, as `useAtomResult` and `useAtomSuspense` do ([Async atoms](/async-atoms)):

<Example files={[{ html: configSource, name: "vitest.config.ts" }]} />

In a SvelteKit app you can add `test` to `vite.config.ts` instead. This site keeps a separate config because its tests need none of the docs plugins.

## Testing atoms

`AtomRegistry.make()` creates a registry. `registry.get` reads an atom, computing it if needed, and `registry.set` writes one:

<Example files={[{ html: counterTestSource, name: "counter.test.ts" }, { html: counterSource, name: "counter.ts" }]} />

Atoms are defined at module level, but their values aren't: each test's registry starts from the initial values, so tests can't leak state into each other.

### Holding an atom with `mount`

A registry drops an atom that nothing reads once the current task ends, as it does when the last component reading it unmounts. The next read starts from the initial value again, which is what the second test shows. In a component the hooks hold the atoms they read. In a test, `registry.mount(atom)` does the same and returns a function that lets go.

Within one synchronous block you don't need it: a `set` followed by a `get` sees the new value.

### Async atoms with `getResult`

An async atom's value is an `AsyncResult`, which starts out `Initial` while the effect runs. `AtomRegistry.getResult(registry, atom)` returns an `Effect` that waits for the result, succeeds with its value and fails with its error, so `Effect.runPromise` turns it into a promise for the test to await. It holds the atom while it waits.

A result that already has a value but is refreshing counts as done. Pass `{ suspendOnWaiting: true }` as a third argument to wait for the fresh value instead.

## Testing components

Render a component with `render` from vitest-browser-svelte, and wrap it in a `RegistryProvider` with the `wrapper` option. `wrapperProps` are the provider's props, and they give you two ways in:

- **`registry`**: a registry made by the test. The test can read what the component wrote and write values for it to show. A registry you pass in is yours to dispose.
- **`initialValues`**: pairs of an atom and a starting value. The provider makes its own registry from them and disposes it when the component unmounts.

<Example files={[{ html: counterComponentTestSource, name: "counter-component.test.ts" }, { html: counterSvelteSource, name: "counter.svelte" }]} />

A provider takes one or the other, not both: it throws if it gets a `registry` along with options for a new one. To start a registry of your own from given values, pass `initialValues` to `AtomRegistry.make`.

<Aside type="caution" title="Always render inside a provider">

Without a `RegistryProvider`, the hooks use one default registry shared by the whole browser session, and in a test run that means by every test in the file. A value one test writes is still there in the next.

</Aside>

## Replacing a runtime's layer

An atom made with `Atom.runtime(layer)` gets its services from that layer. In a test you usually want other services: a fake API, a fixed clock, data held in memory. The runtime keeps its layer in an atom, `runtime.layer`, so you can give it a different starting value like any other atom:

<Example files={[{ html: forecastTestSource, name: "forecast.test.ts" }, { html: forecastSource, name: "forecast.ts" }]} />

The real layer is never built, so nothing reaches the network. The same pair goes in a provider's `initialValues` when you render a component.

<Aside type="caution" title="The test layer replaces the whole layer">

`runtime.layer` holds your layer merged with the runtime's own global layers, including the `Reactivity` service that mutations with `reactivityKeys` use. A test layer replaces all of it, so add `Reactivity.layer` (from `effect/reactivity`) when the atoms under test invalidate keys. `initialValues` aren't type-checked against their atoms either: a layer that is missing a service fails when an atom runs, with `Service not found`.

</Aside>

## Mocking RPC and HTTP API clients

The classes from `AtomRpc.Service` and `AtomHttpApi.Service` have a `runtime` too, and their `runtime.layer` provides the class itself as a service. So you mock a client by giving that atom a layer that provides the class some other way. Its queries and mutations stay the same, so the components and atoms under test need no changes.

### AtomRpc

`RpcTest.makeClient` from `effect/rpc` builds an RPC client that sends each call straight to handlers in the same process, with no transport and no serialization. Give it handlers with your group's `toLayer`, which checks that you handle every procedure with the right payload and result types. This test renders the todo list from the [RPC page](/rpc) against handlers that keep the todos in an array:

<Example files={[{ html: rpcTestSource, name: "rpc.test.ts" }]} />

### AtomHttpApi

For an HTTP API client, build the client from your API definition with `HttpApiClient.make`, over an `HttpClient` that answers requests itself. The responses still go through your endpoints' schemas, so a test also catches a body that doesn't decode, and an error status with an error body comes back as the endpoint's typed error:

<Example files={[{ html: httpTestSource, name: "http.test.ts" }]} />

The base URL can be anything absolute, as no request leaves the test. To answer different endpoints differently, look at `request.method` and `request.url` in the function you pass to `HttpClient.make`.
