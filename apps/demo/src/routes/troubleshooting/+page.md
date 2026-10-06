---
title: Troubleshooting
description: Common errors and surprises, what causes them and how to fix them.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
</script>

This page collects the errors and surprises people run into most often, with what causes each one and how to fix it. Error messages come first, under the text you see; then symptoms without a message.

## Error messages

### "No AtomRegistry in context"

The server throws this when a hook runs with no registry above it. Every hook reads from the nearest `RegistryProvider`, and on the server there is no fallback, because one registry shared at module level would leak one visitor's state into another visitor's page.

Put a `RegistryProvider` around the whole app, in the root layout. See [Add a registry](/installation#add-a-registry).

In the browser, a component with no provider above it uses a shared default registry, so a missing provider only shows up once the page renders on the server.

### "can only be used during component initialisation"

The heading quotes Svelte's message, which uses British spelling.

The hooks find the registry through Svelte's context, which is only available while a component initializes. Svelte throws `lifecycle_outside_component` when a hook is called later, such as from an event handler, a `setTimeout`, or after an `await` inside a function of your own. Call hooks at the top level of the script. To use the registry later, keep what the hook returns, or call [`getRegistry()`](/cookbook#write-atoms-from-a-plain-function) at the top level and keep the registry.

### Async mode is not turned on

Without async mode, Svelte reports one of two errors. The compiler rejects an `await` in markup, `$derived` or at the top level of a script:

```txt
Cannot use `await` in deriveds and template expressions, or at the top level of a component, unless the `experimental.async` compiler option is `true`
```

`useAtomResult` and `useAtomSuspense` call Svelte's `hydratable` for a serializable atom, which throws at runtime. In development the error reads:

```txt
experimental_async_required
Cannot use `hydratable(...)` unless the `experimental.async` compiler option is `true`
```

Turn on async mode in `vite.config.ts`, and in a separate Vitest config if you have one. See [Turn on async mode](/installation#turn-on-async-mode).

### "hydratable_missing_but_required"

While the page hydrates, a hook asked for the server's result for an atom the server never rendered. Svelte throws this in development. A production build only warns, then runs the atom in the browser, and the markup can mismatch.

It happens when a hook's getter picks a different serializable atom in the browser than it did on the server, usually because the choice depends on state only the browser has, such as `localStorage`. Base the first choice on state the server also has, or keep the server's choice until the component has mounted. See [A getter must pick the same atom](/hydration#a-getter-must-pick-the-same-atom).

### "Two different atoms share the serialization key"

Two atoms with the same serialization key were rendered at the same time. The server sends one result per key, so the browser couldn't tell which atom it belongs to.

It usually means a fixed key on an atom that has more than one copy: `Atom.serializable({ key: "todo" })` inside a family, or on an atom created in a component. Put what tells the copies apart into the key, such as the todo's id, and define atoms at module level. For an `AtomRpc` or `AtomHttpApi` query, give each `serializationKey` to only one set of arguments.

### "doesn't encode with its schema, so it isn't sent to the browser"

In development, the server warns when a serializable atom's result doesn't encode with its schema, such as a value that fails one of the schema's checks, or a typed error the schema has no `error` for. The page still renders, but the result isn't sent, so the browser computes the atom again. Fix the schema, or the effect, so the two agree. See [Serializable atoms](/hydration#serializable-atoms).

### "useAtomSuspense read an atom whose server value is pending"

On the server, `useAtomSuspense` read an atom whose [server value](/server-rendering#server-values) is `Initial`, as with `Atom.withServerValueInitial`. The server never runs such an atom, so it has nothing to render. Read it inside a `<svelte:boundary>` with a `pending` snippet, which the server renders instead, or read it with `useAtomResult`.

### "got no value from the server, so it runs again in the browser"

A `useAtomResult` or `useAtomSuspense` call came after a top-level `await` in its component's script, where Svelte has stopped hydrating, so it missed the result the server sent. Call it before the first `await`, and await several hooks together with `Promise.all`. See [Call hooks before the first await](/hydration#call-hooks-before-the-first-await). The warning is shown in development only.

### "provideRegistry takes an existing registry or options for a new one, not both"

A `RegistryProvider` or `provideRegistry` got a `registry` along with `initialValues`, `scheduleTask`, `timeoutResolution` or `defaultIdleTTL`. Those options only apply to a registry the provider creates. Pass them to `AtomRegistry.make` when you create the registry instead.

### "This atom value is read-only"

Something assigned `current` on what `useAtomValue`, `useAtomRef` or `useAtomRefPropValue` returned, for example with `bind:value`. Those only read. Use `useAtom` to read and write an atom, and `useAtomRefProp` and its `set` to write one property of a ref.

### "Service not found"

An atom from a runtime failed with a defect such as `Service not found: app/Weather`. The runtime's layer doesn't provide a service the effect uses. This often happens in tests, where a layer given through `initialValues` replaces the runtime's whole layer and isn't type-checked. Add the missing service to the layer. See [Replacing a runtime's layer](/testing#replacing-a-runtimes-layer).

### Relative URLs on the server

When a page renders on the server, its queries run there too. A client built with a relative URL, such as `/api/rpc`, works in the browser, where the page's origin fills in the rest, but on the server the request fails with an `InvalidUrlError`.

Give the server an absolute URL when you build the client:

**Example** (An absolute URL on the server)

```ts
const origin = import.meta.env.SSR ? "http://localhost:3010" : "";

// In the client's protocol layer.
RpcClient.layerProtocolHttp({ url: `${origin}/api/rpc` });
```

For `AtomHttpApi`, set `baseUrl` the same way. In a real app, read the server's origin from an environment variable rather than writing it into the code.

## Symptoms

### Two copies of effect

In a monorepo, a workspace package compiled from source can get its own copy of `effect`. Two copies have separate schemas and service tags, which then stop matching.

Make sure the bundler loads one copy, for example with `resolve.dedupe` in `vite.config.ts`:

**Example** (Loading one copy of effect)

```ts
// vite.config.ts
export default defineConfig({
  plugins: [sveltekit()],
  resolve: { dedupe: ["effect"] },
});
```

If Vitest has a config of its own, it needs the same setting. To see how many copies are installed, ask your package manager, for example with `npm ls effect`.

### An atom loads forever, or starts over on every read

A hook that gets a new atom on every read starts it again each time. An async atom then never settles, and a writable one loses each write. Look for a new atom made where the hook reads it:

- **`Atom.make` in a getter or `$derived`.** `useAtomValue(() => Atom.make(...))` makes a new atom each time the getter runs. Define the atom at module level, or use a [family](/families) for one atom per key.
- **A family key that compares by reference.** A family returns the same atom for keys with the same contents, but a function compares by reference, so a key that holds one makes a new atom each call. See [Which keys count as the same](/families#which-keys-count-as-the-same).

### My state reset

An atom's value lives in a registry, and the registry only keeps it while something needs it. When a value goes back to its default, look for one of these:

- **Nothing was reading it.** When the last reader goes away, for example when you navigate to a page that doesn't show it, the registry disposes of the atom, and the next read starts again from the initial value. Call `useAtomMount` in a component that stays, such as the layout, to keep it while that component lives. `Atom.keepAlive` and an idle TTL work for every registry. See [Lifetimes](/lifetimes#keeping-atoms-alive).
- **It was set through `initialValues`.** Atoms given a value by `RegistryProvider` are disposed like any other. Mount them with `useAtomMount` in the component that provides them, or give them `Atom.keepAlive`. `useAtomInitialValues` holds its atoms while its component lives, so call it in a component that stays, such as the layout. See [Starting atoms from request data](/sveltekit#starting-atoms-from-request-data).
- **The atom is created inside a component.** `Atom.make` in a component's script makes a new atom each time the component is created. Define atoms at module level, in `<script module>` or a `.ts` file, or use a [family](/families) or a [scoped atom](/scoped-atoms) for one atom per key or per subtree.
- **A second `RegistryProvider`.** Components below a nested provider read its registry, not the root one, and the provider disposes of its registry when it is destroyed. Keep one provider at the root unless you want a separate registry.
- **A save never finished.** A mutation called with the default `"value"` mode is interrupted when its component is destroyed, so navigating away mid-save abandons it. See [Mutations](/mutations#waiting-for-the-result).
- **The page was reloaded.** The browser's registry lasts one page load. To keep a value across reloads, store it with [`Atom.kvs`](/browser#persisting-to-localstorage) or in the URL.

The opposite can surprise too:

- **`useAtomInitialValues` applied only once.** It sets each atom once while the atom is held. A component that mounts again while something still holds the atom, or gets a new prop, doesn't set it again; once the atom has been disposed, the next component to mount sets it again. Write the atom with `useAtomSet` when the prop changes. On the server, each request sets them again.
- **Kept atoms pile up.** `Atom.keepAlive` keeps an atom for the registry's whole life. In a family, every key is an atom of its own, so each key ever used stays. Prefer an idle TTL there. See [Keeping a family's atoms](/families#keeping-a-familys-atoms).

### One visitor sees another visitor's data

Something holds per-visitor state where every request can reach it. Look for one of these:

- **Module state written on the server.** An `AtomRef`, `$state` in a `.svelte.ts` module, a store or a variable at module level is shared by every request. See [Module state is shared between visitors](/server-rendering#module-state-is-shared-between-visitors).
- **A registry that outlives the request.** A registry made at module level and passed to `RegistryProvider` serves every request. Let the provider create one. See [One registry per request](/server-rendering#one-registry-per-request).
- **A shared cache.** A prerendered page, or one a CDN keeps, is served to everyone. See [Prerender or render per request](/sveltekit#prerender-or-render-per-request).
