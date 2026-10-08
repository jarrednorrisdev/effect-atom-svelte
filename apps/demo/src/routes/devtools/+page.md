---
title: Devtools
description: Name your atoms after their variables, and watch your registry live in a panel docked along the bottom of the window.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import Forecast from "./forecast.svelte";
  import forecastSource from "./forecast.svelte?highlight";
</script>

`effect-atom-svelte-devtools` shows you what your atoms are doing. It has three parts:

- a Vite plugin, `atomLabels()`, that names each atom after the variable that holds it;
- a panel, `<AtomDevtools />`, that shows your registry live: its dependency graph, a sheet per atom, and a timeline of everything the registry does;
- the panel's graph on its own, which this site draws above each example.

<Aside type="note" title="This site runs the panel">

On a wide screen, the **Atoms** button at the bottom right of the window, or **Alt+Shift+A**, opens the panel on this site's own registry. Open it while you use the examples on any page.

</Aside>

<Example files={[{ html: forecastSource, name: "forecast.svelte" }]} hint="Open Atoms at the bottom right and click Paris: forecastAtom rings green when it loads. Then click Tokyo and Atlantis quickly: the Tokyo load is interrupted, and Atlantis rings red."> <Forecast /> </Example>

## Installing

Add the package as a development dependency:

```bash
bun add -D effect-atom-svelte-devtools
```

It reads the registry through effect-atom-svelte's inspector (`effect-atom-svelte/inspector`), which is new in effect-atom-svelte 0.2. Devtools 0.2 goes with effect-atom-svelte 0.2.

## Naming atoms

Most atoms have no label, so a tool can only call them "atom". `atomLabels()` labels each atom with the name of its variable and where it is declared. Add it to your Vite config before `sveltekit()`, so it sees components before they are compiled:

```ts
// vite.config.ts
import { sveltekit } from "@sveltejs/kit/vite";
import { atomLabels } from "effect-atom-svelte-devtools/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [atomLabels(), sveltekit()],
});
```

It names atoms declared at the top level of a module or of a component's script, which is where most atoms live:

- `const todosAtom = Atom.make(...)` is named `todosAtom`.
- A family's members are named after their argument: `todoAtom(3)`.
- A call to a function whose name ends in `Atom` names the atom it returns after the call: `mapDraftAtom({"doc":1})`. Two atoms made for equal keys get the same name, which is what a hand-rolled cache that keeps making new atoms looks like.
- An atom in a top-level object is named by its path: `pair.todosAtom`.
- A label your code sets with `Atom.withLabel` wins.

Each component is named too (`Counter`, from `counter.svelte`), so tools can say which component reads each atom.

The plugin only runs in the dev server. Pass `builds: true` to label production builds too, for a page that shows atoms' names in production, as this site does.

### State across hot reloads

A hot reload runs a module again, which makes new atoms, so the state written to the old ones would be lost. With the plugin, a state atom a module declares (`Atom.make` of a plain value) takes the value of the atom it replaces. Edit a component and its counters keep their counts.

Edit the atom's own declaration and it starts from its new value instead: the old one no longer applies. Atoms declared in a component's `<script>` aren't kept: there is one per instance, so there is no telling which old one a new one replaces.

## The panel

Render `<AtomDevtools />` inside your `RegistryProvider`, behind `import.meta.env.DEV`:

```svelte
<!-- src/routes/+layout.svelte -->
<RegistryProvider>
  {@render children()}
  {#if import.meta.env.DEV}
    {#await import("effect-atom-svelte-devtools") then { AtomDevtools }}
      <AtomDevtools />
    {/await}
  {/if}
</RegistryProvider>
```

Vite replaces `import.meta.env.DEV` with `false` in a build, so the import is left out of production. SvelteKit's `dev` would leave the panel's code in the build, unused.

Closed, the panel is an **Atoms** button in the corner with the registry's count of atoms. Open, it docks along the bottom of the window, and the page gets room below it. Drag its top line to resize it, or enlarge it to most of the window. Its bar counts the registry's atoms, readers, updates and interruptions.

**Alt+Shift+A** opens and closes it from anywhere on the page. Pass `shortcut` to give your app another default:

```svelte
<AtomDevtools shortcut="ctrl+shift+f2" />
```

It follows the registry of the nearest `RegistryProvider`, or one you pass as `registry`. With more than one provider mounted, a picker switches between them. It starts watching when it mounts: until then the inspector costs your registry nothing.

### Graph

The atoms and what reads what, sources on the left and components on the right.

- An atom whose value changes rings: green for a `Success`, red for a `Failure`.
- A cross marks an interrupted effect or an atom the registry removed.
- A family's atoms share a row of dots.
- Click an atom to open its sheet.

**Plumbing** shows the atoms that runtimes, mutations and stores make for themselves, which are hidden by default.

### Sheets

A cover sheet with the registry's totals, then one sheet per atom. A sheet shows the atom's value or `AsyncResult` state, what it reads and what reads it, what happened to it lately, and where it is declared: click the place to open it in your editor. Its title block says whether the atom is kept alive, its idle TTL and how many readers it has.

### Timeline

Every computation, update, interruption and finalizer, newest first. A computation says why it ran: its first read, a refresh, or a change to an atom it reads. Click an atom's name to see only its rows.

### Settings

- **Shortcut**: click **Change** and press a new one. It needs Ctrl, Alt or ⌘ (or a function key), so it can't catch typing.
- **Button**: the corner the button sits in. You can also drag the button: it settles in the nearest corner.
- **Opacity** and **Size**: how faint and how big the button is. A faded button is opaque again while you point at it or focus it.

The panel keeps its settings in `localStorage`, with its height and the view you left it on.

## In production

The panel renders nothing in a production build. To show it there on purpose, say for a demo whose visitors should see its atoms, render it without the `DEV` check and set `production`:

```svelte
<AtomDevtools production />
```

In production it shows the nearest provider's registry, or the one you pass, with no picker: only development keeps a list of every provider's registry. Declarations aren't links to your editor, which only the dev server can open. Atoms have names only if `atomLabels({ builds: true })` labels the build.

## Drawing a part of your app

The graph above each example on this site is the panel's graph, drawn for one part of the page. Two pieces make it:

- `provideInspectorScope()` from `effect-atom-svelte/inspector` makes the component that calls it, and everything below it, a scope. The hooks below it report the atoms they use, and the scope gives you those atoms, everything upstream of them and the components that read them, with events for just those atoms. See [Inspector](/reference/Inspector) for its API.
- `<AtomGraph>` from `effect-atom-svelte-devtools/graph` lays out and draws those atoms. Call its `pulse(id, tone)` when an atom's value changes and `interrupt(id)` when its effect is interrupted.

The graph has no dependencies beyond Svelte, and inspector scopes work in production, so the graph can go in production pages. It reads your page's design tokens (`--foreground`, `--border`, `--brand`) where it has them.
