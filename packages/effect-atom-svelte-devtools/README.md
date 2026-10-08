# effect-atom-svelte-devtools

Developer tools for [effect-atom-svelte](https://atom.jarrednorris.dev): a panel that shows your atom registry live, and a Vite plugin that names your atoms after their variables and keeps their state across hot reloads.

```sh
bun add -D effect-atom-svelte-devtools
```

It reads effect-atom-svelte's inspector, which is new in effect-atom-svelte 0.2: devtools 0.2 goes with effect-atom-svelte 0.2.

## The panel

`<AtomDevtools />` docks a panel along the bottom of the window that shows your app's atom registry live. Put it inside your `RegistryProvider`, behind Vite's `import.meta.env.DEV`, so production builds leave it out entirely:

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

Use `import.meta.env.DEV` rather than SvelteKit's `dev`: Vite replaces it with `false` in a build, so the import is dropped, where `dev` leaves the panel's code in the build unused.

The panel renders nothing in a production build, so leaving out the `DEV` check only costs the download. To show it in production on purpose, say for a demo that lets its visitors watch its atoms (as the effect-atom-svelte docs do), render it without the check and set `production`:

```svelte
<AtomDevtools production />
```

In production it shows the registry of the nearest `RegistryProvider`, or the one you pass, with no picker: only development keeps the list of every provider's registry. Declarations aren't links to your editor, which only the dev server can open, and atoms have names only if `atomLabels({ builds: true })` labels the build.

Closed, it's a small "Atoms" button in the corner with the registry's count. Open, drag its top line to make it taller or shorter (double-click to reset; with the keyboard, focus it and use the arrow keys), or enlarge it to most of the window; the page gets room below it while it's open, and Escape closes it while focus is inside it. It's drawn in hairlines with mono labels, in your page's colours and fonts where it has them (see [Theming](#theming)), and in zinc and amber, light or dark, where it doesn't. Its bar counts the registry's atoms, readers, updates and interruptions.

Alt+Shift+A opens and closes it from anywhere on the page. Set the app's own with the `shortcut` prop (`<AtomDevtools shortcut="ctrl+shift+f2" />`); whoever uses the panel can change it in its settings.

It has three views, and settings:

- **Graph**: the atoms and what reads what, laid out on tracks with sources on the left, as the effect-atom-svelte docs draw their examples. A value that changes rings, in green when it's a `Success` and red when it's a `Failure`; a cross marks an interrupted effect or a removed atom; a family's atoms share a row of dots. Click an atom to open its sheet. "Plumbing" shows the atoms runtimes, mutations and stores make, which are hidden by default; an atom that reads one is linked to whatever is upstream of it.
- **Sheets**: a cover sheet with the registry's totals, then one sheet per atom: its value or `AsyncResult` state, what it reads and what reads it, what happened to it lately, and a title block with where it was declared (click to open it in your editor), keep-alive, idle TTL and readers.
- **Timeline**: every computation, update, interruption and finalizer, newest first. A computation says why it ran: its first read, a refresh, or which atoms it reads changed. Click an atom to see only its rows.
- **Settings**: the shortcut (click Change and press a new one: it needs Ctrl, Alt or Meta, or a function key, so it can't catch typing), and the button's corner, opacity and size. Drag the button to move it, too: it settles in the nearest corner. A faded button is opaque again while you point at it or focus it. The panel saves its settings in `localStorage`.

It follows the registry of the nearest `RegistryProvider`, or a `registry` you pass it. With more than one provider mounted, a picker switches between them. It reads what the registry does through `effect-atom-svelte/inspector`, which starts watching when the panel mounts and costs nothing before.

### Theming

The panel takes its colours and fonts from CSS variables. It reads the ones a Tailwind or shadcn app already has, so it often matches your app with no setup:

| Variable | What it colours or sets |
| --- | --- |
| `--background`, `--foreground` | The panel, and its text |
| `--muted-foreground`, `--subtle-foreground` | Quieter text: labels, notes, timestamps |
| `--border` | Its hairlines |
| `--brand`, `--brand-text` | The accent: atoms' rings, the current tab, numbers |
| `--tone-success`, `--tone-failure` | A success's green ring, a failure's red one |
| `--font-mono` | Labels, names and values |
| `--font-serif` | The italic notes |

Any it doesn't find fall back to zinc and amber, a monospace and the system serif. To give the panel colours or fonts of its own, different from the page's, set the variables on `[data-atom-devtools]`:

```css
[data-atom-devtools] {
  --brand: oklch(0.6 0.2 300);
  --font-serif: "Iowan Old Style", Georgia, serif;
}
```

`theme` picks light or dark (`auto`, the default, follows a `dark` class on `<html>`, or the system's setting). The graph module reads the same variables.

## The graph

The graph the panel draws is also yours to use, from `effect-atom-svelte-devtools/graph`. It has no dependencies beyond Svelte, so unlike the panel it can go in production pages: the effect-atom-svelte docs draw each example's atoms with it, from an inspector scope.

- `layoutGraph({ atoms, links, readers }, width)` lays atoms, the links between them and the components that read them out on tracks.
- `<AtomGraph graph={…} />` draws a layout live. Call its `pulse(id, tone)` when an atom's value changes and `interrupt(id)` when its effect is interrupted; give it `onselect` to make atoms clickable.
- `<FrameGraph nodes={…} edges={…} />` draws nodes and edges you place yourself, on a frame's 1px lines.

It reads the same variables as the panel ([Theming](#theming)) and falls back to a neutral palette.

## Atom names

Most atoms have no label, so tools can only show them as "atom". `atomLabels()` labels each atom declared at the top level of a module, or of a component's `<script>` or `<script module>`, with its variable's name and where it is declared:

```ts
export const todosAtom = Atom.make(...)
// todosAtom.label: ["todosAtom", "at todosAtom (/src/lib/todos.ts:4:14)"]
```

```ts
// vite.config.ts
import { sveltekit } from "@sveltejs/kit/vite";
import { atomLabels } from "effect-atom-svelte-devtools/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [atomLabels(), sveltekit()],
});
```

- Only the dev server applies it, unless you pass `builds: true`: then production builds are labelled too (without keeping values across reloads, which builds don't have), for a page that shows atoms' names in production.
- Put it before `sveltekit()` or `svelte()`, so it sees components before they are compiled. It warns if it comes after.
- The atom is labelled in place and keeps its identity. `Atom.withLabel` would return a copy.
- A label your code sets with `Atom.withLabel` wins. The one an `Atom.serializable` atom takes from its key (an RPC query's `AtomRpc:listTodos:home-todos`) gives way to the variable's name.
- Members of an `Atom.family` are labelled with their argument, as `todoAtom(3)`.
- A call to a function whose name ends in `Atom` (`mapDraftAtom(key)`, `makeSessionAtom(user)`) names the atom it returns after the call and its arguments, as `mapDraftAtom({"doc":1})`. Every call's atom is named, so two atoms made for equal keys share a name: what a hand-rolled cache that keeps making new atoms looks like. A more specific label wins: a family's, a top-level variable's, or one your code set. Only plain calls count, not methods (`store.todoAtom(1)`).
- It wraps any top-level `const x = f(...)` and checks at run time whether the value is an atom, so `runtime.atom(...)`, `TodosRpc.query(...)` and your own helpers are labelled too. Runes and `use*` hooks are left alone.
- An atom in a top-level object literal is named by its path: `const pair = { todosAtom: Atom.make(...) }` labels `pair.todosAtom`.
- Inside functions, only `Atom.*` calls are labelled, so a function that makes atoms names them without every other call in it being wrapped.
- Atoms in mdsvex (`.md`) pages aren't labelled.
- Each component's instance script also starts by naming the component (`Counter`, from `counter.svelte`), so an inspector scope (`provideInspectorScope` in `effect-atom-svelte/inspector`) can say which component reads each atom.

## State across hot reloads

A hot reload runs a module again, which makes new atoms, so state written to them is lost. With the plugin, a state atom a module declares (`Atom.make` of a plain value, such as `Atom.make(0)` or `Atom.make([]).pipe(Atom.keepAlive)`, in a module or a `<script module>`) takes the value of the atom it replaces. Edit a component and its counters keep their counts.

- Edit the atom's own declaration and it starts from its new value: the old one no longer applies.
- Derived atoms compute again from the kept values, and effects run again, as their code may have changed.
- Atoms in a component's `<script>` aren't kept: there is one per instance, so there is no telling which old one a new one replaces.
