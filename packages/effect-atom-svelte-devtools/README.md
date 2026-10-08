# effect-atom-svelte-devtools

Developer tools for [effect-atom-svelte](https://atom.jarrednorris.dev): a panel that shows your atom registry live, and a Vite plugin that names your atoms after their variables and keeps their state across hot reloads. Not published yet.

## The panel

`<AtomDevtools />` opens a floating panel over your app that shows its atom registry live. Put it inside your `RegistryProvider`, behind Vite's `import.meta.env.DEV`, so production builds leave it out entirely:

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

It has three views:

- **Graph**: the atoms and what reads what, sources on the left. A value that changes pulses, a tick is a reader, a cross marks an interrupted effect or a removed atom. "plumbing" shows the atoms runtimes, mutations and stores make, which are hidden by default; an atom that reads one is linked to whatever is upstream of it.
- **Sheets**: a cover sheet with the registry's totals, then one sheet per atom: its value or `AsyncResult` state, what it reads and what reads it, what happened to it lately, and a title block with where it was declared (click to open it in your editor), keep-alive, idle TTL and readers.
- **Timeline**: every computation, update, interruption and finalizer, newest first. A computation says why it ran: its first read, a refresh, or which atoms it reads changed. Click an atom to see only its rows.

It follows the registry of the nearest `RegistryProvider`, or a `registry` you pass it. With more than one provider mounted, a picker switches between them. It reads what the registry does through `effect-atom-svelte/inspector`, which starts watching when the panel mounts and costs nothing before.

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

- Only the dev server applies it. Production builds are left as they are.
- Put it before `sveltekit()` or `svelte()`, so it sees components before they are compiled. It warns if it comes after.
- The atom is labelled in place and keeps its identity. `Atom.withLabel` would return a copy.
- A label your code sets with `Atom.withLabel` wins. The one an `Atom.serializable` atom takes from its key (an RPC query's `AtomRpc:listTodos:home-todos`) gives way to the variable's name.
- Members of an `Atom.family` are labelled with their argument, as `todoAtom(3)`.
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
