# effect-atom-svelte-devtools

Developer tools for [effect-atom-svelte](https://atom.jarrednorris.dev). Work in progress: so far, a Vite plugin that names your atoms.

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
